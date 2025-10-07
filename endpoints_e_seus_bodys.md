PATCH
​/merchants​/{merchantId}​/options​/price

Request body

application/json
Value object representation of an option new price value

Example Value
Schema
{
  "optionId": "string",
  "price": {
    "value": 20,
    "originalValue": 30
  },
  "parentCustomizationOptionId": "string",
  "priceByCatalog": [
    {
      "value": 20,
      "originalValue": 30,
      "catalogContext": "string"
    }
  ]
}

PATCH
​/merchants​/{merchantId}​/options​/status
{
  "optionId": "string",
  "status": "AVAILABLE",
  "parentCustomizationOptionId": "string",
  "statusByCatalog": [
    {
      "status": "AVAILABLE",
      "catalogContext": "string"
    }
  ]
}

