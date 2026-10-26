// Foundation resources for Sylvia. AI Search and the Foundry/OpenAI deployment are added in steps 2–3,
// once model quota on the subscription is confirmed.

param environmentName string
param location string
param mapsLocation string
param tags object

var token = toLower(uniqueString(subscription().id, environmentName, location))
var acrPullRole = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

// ---------- Monitoring ----------
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${token}'
  location: location
  tags: tags
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${token}'
  location: location
  tags: tags
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: logs.id }
}

// ---------- Secrets ----------
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${token}'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

// ---------- Storage: plant photos (30-day lifecycle) + Functions ----------
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'st${token}'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource photos 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'photos'
  properties: { publicAccess: 'None' }
}

resource functionsPackage 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'functions-package'
  properties: { publicAccess: 'None' }
}

resource photoLifecycle 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'delete-photos-after-30-days'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: { blobTypes: ['blockBlob'], prefixMatch: ['photos/'] }
            actions: { baseBlob: { delete: { daysAfterModificationGreaterThan: 30 } } }
          }
        }
      ]
    }
  }
}

var storageConnection = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

// ---------- Database: Cosmos DB serverless ----------
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: 'cosmos-${token}'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [{ name: 'EnableServerless' }]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [{ locationName: location, failoverPriority: 0 }]
    minimalTlsVersion: 'Tls12'
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmos
  name: 'sylvia'
  properties: { resource: { id: 'sylvia' } }
}

// ---------- Maps ----------
resource maps 'Microsoft.Maps/accounts@2023-06-01' = {
  name: 'map-${token}'
  location: mapsLocation
  tags: tags
  kind: 'Gen2'
  sku: { name: 'G2' }
  properties: { disableLocalAuth: false }
}

// ---------- Web app: Container Apps ----------
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'cr${token}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource webIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-web-${token}'
  location: location
  tags: tags
}

resource webAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: registry
  name: guid(registry.id, webIdentity.id, acrPullRole)
  properties: {
    principalId: webIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRole)
  }
}

resource appsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${token}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource web 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-web-${token}'
  location: location
  tags: union(tags, { 'azd-service-name': 'web' })
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${webIdentity.id}': {} } }
  dependsOn: [webAcrPull]
  properties: {
    managedEnvironmentId: appsEnv.id
    configuration: {
      ingress: { external: true, targetPort: 3000, transport: 'auto' }
      registries: [{ server: registry.properties.loginServer, identity: webIdentity.id }]
    }
    template: {
      containers: [
        {
          name: 'web'
          // azd replaces this placeholder with the built image on `azd deploy`.
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
            { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
          ]
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 2 }
    }
  }
}

// ---------- Functions: Flex Consumption ----------
resource functionsPlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: 'plan-func-${token}'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: { name: 'FC1', tier: 'FlexConsumption' }
  properties: { reserved: true }
}

resource functions 'Microsoft.Web/sites@2024-04-01' = {
  name: 'func-${token}'
  location: location
  tags: union(tags, { 'azd-service-name': 'functions' })
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: functionsPlan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}${functionsPackage.name}'
          authentication: { type: 'StorageAccountConnectionString', storageAccountConnectionStringName: 'DEPLOYMENT_STORAGE_CONNECTION_STRING' }
        }
      }
      scaleAndConcurrency: { maximumInstanceCount: 40, instanceMemoryMB: 2048 }
      runtime: { name: 'node', version: '22' }
    }
    siteConfig: {
      appSettings: [
        { name: 'AzureWebJobsStorage', value: storageConnection }
        { name: 'DEPLOYMENT_STORAGE_CONNECTION_STRING', value: storageConnection }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'COSMOS_ENDPOINT', value: cosmos.properties.documentEndpoint }
      ]
    }
  }
}

output registryEndpoint string = registry.properties.loginServer
output keyVaultName string = vault.name
output cosmosEndpoint string = cosmos.properties.documentEndpoint
output webUrl string = 'https://${web.properties.configuration.ingress.fqdn}'
output functionsUrl string = 'https://${functions.properties.defaultHostName}'
output mapsAccountName string = maps.name
