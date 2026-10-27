targetScope = 'subscription'

@minLength(1)
@maxLength(32)
@description('azd environment name, e.g. sylvia-dev. Used to name every resource.')
param environmentName string

@description('Primary region. Canada Central keeps Canadian data in Canada.')
param location string = 'canadacentral'

@description('Azure Maps has a short list of regions, and Azure for Students only allows five; westus2 is in both. Maps stores no user data.')
param mapsLocation string = 'westus2'

@description('Email for the monthly budget alert. Leave empty to skip the budget.')
param budgetAlertEmail string = ''

@description('Monthly budget in the subscription currency.')
param budgetAmount int = 40

param budgetStartDate string = '2026-11-01'

@description('False while no Cosmos DB region has capacity for this subscription.')
param enableCosmos bool = true

@description('Cosmos DB region; defaults to the primary region.')
param cosmosLocation string = location

@secure()
@description('Pl@ntNet API key, from azd env PLANTNET_API_KEY.')
param plantnetApiKey string = ''

param webOrigin string = ''

@secure()
param firmsMapKey string = ''

@secure()
param purpleairApiKey string = ''

@description('Web container image tag published by GitHub Actions.')
param webImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

var tags = { 'azd-env-name': environmentName, app: 'sylvia' }

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    environmentName: environmentName
    location: location
    mapsLocation: mapsLocation
    tags: tags
    enableCosmos: enableCosmos
    cosmosLocation: cosmosLocation
    webImage: webImage
    plantnetApiKey: plantnetApiKey
    firmsMapKey: firmsMapKey
    webOrigin: webOrigin
    purpleairApiKey: purpleairApiKey
  }
}

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = if (!empty(budgetAlertEmail)) {
  name: 'budget-${environmentName}'
  properties: {
    category: 'Cost'
    amount: budgetAmount
    timeGrain: 'Monthly'
    timePeriod: { startDate: budgetStartDate }
    notifications: {
      actual80: { enabled: true, operator: 'GreaterThan', threshold: 80, contactEmails: [budgetAlertEmail] }
      forecast100: { enabled: true, operator: 'GreaterThan', threshold: 100, thresholdType: 'Forecasted', contactEmails: [budgetAlertEmail] }
    }
  }
}

output AZURE_LOCATION string = location
output AZURE_RESOURCE_GROUP string = rg.name
output WEB_APP_NAME string = resources.outputs.webAppName
output AZURE_AI_ENDPOINT string = resources.outputs.aiEndpoint
output SEARCH_ENDPOINT string = resources.outputs.searchEndpoint
output AZURE_KEY_VAULT_NAME string = resources.outputs.keyVaultName
output COSMOS_ENDPOINT string = resources.outputs.cosmosEndpoint
output WEB_URL string = resources.outputs.webUrl
output FUNCTIONS_URL string = resources.outputs.functionsUrl
