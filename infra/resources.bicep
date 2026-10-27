// Sylvia's Azure resources.

param environmentName string
param location string
param mapsLocation string
param tags object

@description('Cosmos DB can be switched off while a region has no capacity for this subscription.')
param enableCosmos bool = true
param cosmosLocation string = location

@description('Region for Azure AI Foundry models (Sweden Central has vision quota on Azure for Students).')
param aiLocation string = 'swedencentral'

@secure()
@description('Pl@ntNet API key (azd env PLANTNET_API_KEY). Second-opinion plant identification.')
param plantnetApiKey string = ''

@description('The web app address (azd env WEB_URL), allowed to call Azure Maps from browsers.')
param webOrigin string = ''

@secure()
param firmsMapKey string = ''

@secure()
param purpleairApiKey string = ''

@description('Web container image, e.g. ghcr.io/miflowe/sylvia-web:<sha>. Placeholder until the first image is published.')
param webImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

var token = toLower(uniqueString(subscription().id, environmentName, location))
var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

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

var cosmosEndpoint = enableCosmos ? cosmos!.properties.documentEndpoint : ''

var storageConnection = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'

// ---------- Database: Cosmos DB serverless ----------
// Named per region: a Cosmos account name stays reserved in its old region for a while after deletion.
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = if (enableCosmos) {
  name: 'cosmos-${toLower(uniqueString(subscription().id, environmentName, cosmosLocation))}'
  location: cosmosLocation
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [{ name: 'EnableServerless' }]
    consistencyPolicy: { defaultConsistencyLevel: 'Session' }
    locations: [{ locationName: cosmosLocation, failoverPriority: 0 }]
    minimalTlsVersion: 'Tls12'
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = if (enableCosmos) {
  parent: cosmos
  name: 'sylvia'
  properties: { resource: { id: 'sylvia' } }
}

// Containers and partition keys (see docs/decisions.md). Serverless accounts take no throughput settings.
// `geo` adds a spatial index on /location for "within N km" queries; `ttl` lets items expire (-1 = per item).
var cosmosContainers = [
  { name: 'species', pk: '/id', geo: false, ttl: null }
  { name: 'regionVerdicts', pk: '/regionCode', geo: false, ttl: null }
  { name: 'nurseriesCurated', pk: '/regionCode', geo: true, ttl: null }
  { name: 'observations', pk: '/cellId', geo: true, ttl: -1 }
  { name: 'officialAlerts', pk: '/regionCode', geo: true, ttl: -1 }
  { name: 'alerts', pk: '/deviceOrUserId', geo: false, ttl: null }
  { name: 'pushSubscriptions', pk: '/deviceOrUserId', geo: true, ttl: null }
  { name: 'scans', pk: '/deviceOrUserId', geo: false, ttl: null }
  { name: 'checklists', pk: '/deviceOrUserId', geo: false, ttl: null }
  { name: 'sightings', pk: '/cellId', geo: true, ttl: null }
  { name: 'replayEvents', pk: '/eventId', geo: false, ttl: null }
]

var geoIndexing = {
  indexingMode: 'consistent'
  includedPaths: [{ path: '/*' }]
  excludedPaths: [{ path: '/shape/*' }, { path: '/"_etag"/?' }]
  spatialIndexes: [{ path: '/location/?', types: ['Point', 'Polygon'] }]
}

resource containers 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = [
  for c in cosmosContainers: if (enableCosmos) {
    parent: cosmosDb
    name: c.name
    properties: {
      resource: union(
        { id: c.name, partitionKey: { paths: [c.pk], kind: 'Hash' } },
        c.geo ? { indexingPolicy: geoIndexing } : {},
        c.ttl == null ? {} : { defaultTtl: c.ttl }
      )
    }
  }
]

// ---------- Search: native look-alikes (free tier, one per subscription) ----------
resource search 'Microsoft.Search/searchServices@2024-06-01-preview' = {
  name: 'srch-${token}'
  location: location
  tags: tags
  sku: { name: 'free' }
  properties: { hostingMode: 'default', partitionCount: 1, replicaCount: 1 }
}

// ---------- Maps ----------
resource maps 'Microsoft.Maps/accounts@2023-06-01' = {
  name: 'map-${token}'
  location: mapsLocation
  tags: tags
  kind: 'Gen2'
  sku: { name: 'G2' }
  properties: {
    disableLocalAuth: false
    // The browser map uses the key, so only Sylvia's own web address (and local dev) may call Azure Maps from a browser.
    cors: {
      corsRules: [
        { allowedOrigins: empty(webOrigin) ? ['http://localhost:3000'] : [webOrigin, 'http://localhost:3000'] }
      ]
    }
  }
}

// ---------- Web app: Container Apps ----------
// The image is built by GitHub Actions and published to GitHub's container registry: Azure for Students blocks
// ACR remote builds. scripts/deploy-web.sh points the app at a new image tag.
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
  tags: tags
  // No managed identity: this subscription gets an express Container Apps environment, which doesn't support it.
  properties: {
    managedEnvironmentId: appsEnv.id
    configuration: {
      ingress: { external: true, targetPort: webImage == placeholderImage ? 80 : 3000, transport: 'auto' }
      secrets: [
        { name: 'ai-key', value: ai.listKeys().key1 }
        { name: 'cosmos-key', value: enableCosmos ? cosmos!.listKeys().primaryMasterKey : 'cosmos-disabled' }
        { name: 'search-key', value: search.listQueryKeys().value[0].key }
        { name: 'plantnet-key', value: empty(plantnetApiKey) ? 'not-set' : plantnetApiKey }
        { name: 'storage-connection', value: storageConnection }
        { name: 'maps-key', value: maps.listKeys().primaryKey }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webImage
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
            { name: 'COSMOS_ENDPOINT', value: cosmosEndpoint }
            { name: 'AZURE_AI_ENDPOINT', value: ai.properties.endpoint }
            { name: 'SEARCH_ENDPOINT', value: 'https://${search.name}.search.windows.net' }
            { name: 'AZURE_AI_KEY', secretRef: 'ai-key' }
            { name: 'COSMOS_KEY', secretRef: 'cosmos-key' }
            { name: 'SEARCH_KEY', secretRef: 'search-key' }
            { name: 'PLANTNET_API_KEY', secretRef: 'plantnet-key' }
            { name: 'STORAGE_CONNECTION', secretRef: 'storage-connection' }
            { name: 'AZURE_MAPS_KEY', secretRef: 'maps-key' }
          ]
        }
      ]
      scale: { minReplicas: 0, maxReplicas: 2 }
    }
  }
}

// ---------- AI: Azure AI Foundry (AI Services) in Sweden Central ----------
// Vision models are only available to this subscription in Sweden Central. Standard (regional) deployments keep
// processing in Sweden. The same resource also provides Azure AI Content Safety.
resource ai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: 'ai-${token}'
  location: aiLocation
  tags: tags
  kind: 'AIServices'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: 'ai-${token}'
    publicNetworkAccess: 'Enabled'
  }
}

resource visionModel 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: ai
  name: 'gpt-4o'
  // Used for identification and explanations. gpt-4o-mini can no longer be deployed (deprecated 2026-03-31);
  // gpt-4o retires 2027-04-14, so swap models before the spring rounds.
  sku: { name: 'Standard', capacity: 45 }
  properties: { model: { format: 'OpenAI', name: 'gpt-4o', version: '2024-11-20' } }
}

resource embeddingModel 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: ai
  name: 'text-embedding-3-large'
  sku: { name: 'Standard', capacity: 50 }
  properties: { model: { format: 'OpenAI', name: 'text-embedding-3-large', version: '1' } }
  dependsOn: [visionModel]
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
        { name: 'COSMOS_ENDPOINT', value: cosmosEndpoint }
        { name: 'COSMOS_KEY', value: enableCosmos ? cosmos!.listKeys().primaryMasterKey : '' }
        { name: 'AZURE_AI_ENDPOINT', value: ai.properties.endpoint }
        { name: 'SEARCH_ENDPOINT', value: 'https://${search.name}.search.windows.net' }
        { name: 'FIRMS_MAP_KEY', value: firmsMapKey }
        { name: 'PURPLEAIR_API_KEY', value: empty(purpleairApiKey) ? 'not-set' : purpleairApiKey }
      ]
    }
  }
}

output webAppName string = web.name
output aiEndpoint string = ai.properties.endpoint
output searchEndpoint string = 'https://${search.name}.search.windows.net'
output keyVaultName string = vault.name
output cosmosEndpoint string = cosmosEndpoint
output webUrl string = 'https://${web.properties.configuration.ingress.fqdn}'
output functionsUrl string = 'https://${functions.properties.defaultHostName}'
output mapsAccountName string = maps.name
