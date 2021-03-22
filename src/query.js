const AWSXRay = require('aws-xray-sdk')
AWSXRay.captureHTTPsGlobal(require('http'))
AWSXRay.captureHTTPsGlobal(require('https'))
const fetch = require('node-fetch')
const xml2js = require('xml2js')
const { t: typy } = require('typy')
const { successResponse } = require('./shared/response')
const { sentryWrapper } = require('./shared/sentryWrapper')

module.exports.handler = sentryWrapper(async (event, context, callback) => {
  const params = event.queryStringParameters || {}
  const docids = params.docids.split(',').map(docid => encodeURIComponent(docid)).join('+OR+')

  const url = `${process.env.PRIMO_URL}/PrimoWebServices/xservice/search/brief?onCampus=false&institution=NDU&loc=local,scope:(NDU)&query=rid,contains,${docids}&bulkSize=10&indx=1`
  const xmlParser = xml2js.Parser({
    tagNameProcessors: [xml2js.processors.stripPrefix],
    attrNameProcessors: [xml2js.processors.stripPrefix],
  })

  console.log(`Running primo query for docs ${docids}.`)

  let error = null
  const results = await fetch(url)
    .then(response => {
      if (response.ok) {
        return response.text()
      } else {
        error = response
      }
    })
    .then(xmlString => typy(xmlString).isString ? xmlParser.parseStringPromise(xmlString) : null)

  if (error) {
    // Technically use success because we handled the http error
    return successResponse(callback, null, error.status)
  }

  // parse out availaibility information
  // contains codes like $$[key][value] where the character denotes data type
  const availRegex = /\$\$([a-zA-Z0-9])([^$]*)/g
  const availFieldsMap = {
    I: 'institution',
    L: 'library',
    1: 'collection',
    2: 'callNumber',
    S: 'availability',
    O: 'recordId',
    Y: 'subLibraryCode',
    Z: 'collectionCode',
  }

  const validEntries = []
  const records = typy(results, 'SEGMENTS.JAGROOT[0].RESULT[0].DOCSET[0].DOC').safeArray
  console.log(`Primo search found ${records.length} doc(s).`)

  if (records.length) {
    records.forEach(record => {
      typy(record, 'PrimoNMBib[0].record[0].display[0].availlibrary').safeArray.forEach(avail => {
        const entry = {}
        let match = []
        while ((match = availRegex.exec(avail.trim())) !== null) {
          if (match.length > 2 && Object.keys(availFieldsMap).includes(match[1])) {
            entry[availFieldsMap[match[1]]] = match[2]
          }
        }

        if (!entry.recordId) {
          entry.recordId = typy(record, 'PrimoNMBib[0].record[0].control[0].recordid[0]').safeString.trim()
        }

        validEntries.push(entry)
      })
    })
  } else {
    // Not found
    return successResponse(callback, null, 404)
  }

  return successResponse(callback, validEntries)
})
