const fetch = require('node-fetch')
const { successResponse } = require('./shared/response')
const { sentryWrapper } = require('./shared/sentryWrapper')
const { mapApiItems } = require('./shared/helpers')

module.exports.handler = sentryWrapper(async (event, context, callback) => {
  const params = event.queryStringParameters || {}

  const userId = encodeURIComponent(params.alephId)
  const institution = encodeURIComponent(params.institution || 'NDU')

  const url = `${process.env.PRIMO_URL}/primo/v1/eshelf/${userId}?inst=${institution}`

  console.log(`Getting primo favorites from ${url}.`)

  let error = null
  const results = await fetch(url)
    .then(response => {
      if (response.ok) {
        return response.json()
      } else {
        error = response
      }
    })

  if (error) {
    // Technically use success because we handled the http error
    return successResponse(callback, null, error.status)
  }

  const items = results['basket-items']
  console.log(`Got ${items.length} item(s).`)

  const output = mapApiItems(items, institution)

  return successResponse(callback, output)
})
