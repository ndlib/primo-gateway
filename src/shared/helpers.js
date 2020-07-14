module.exports.mapApiItems = (items, institution = 'NDU') => {
  return items.map(item => {
    const docId = item.pnxId
    const display = docId
      ? `${process.env.PRIMO_URL}/primo_library/libweb/action/dlDisplay.do?vid=${encodeURIComponent(institution)}&search_scope=malc_blended&docId=${encodeURIComponent(docId)}&fn=permalink`
      : null

    return {
      title: item.title,
      author: item.author,
      display: display,
      type: item['@TYPE'],
      id: item['@id'],
    }
  })
}
