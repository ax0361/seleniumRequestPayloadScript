const { Builder } = require('selenium-webdriver');
const edge = require('selenium-webdriver/edge');

async function extractURLs(url){
  const options = new edge.Options();
  options.addArguments('--headless')

  const driver = await new Builder().forBrowser('MicrosoftEdge').setEdgeOptions(options).build();
  driver.get(url)
  const links = await driver.findElements({tagName: 'a'})
  const urls = await Promise.all(links.map(async (link) => {
    return await link.getAttribute('href')
  }))
  await driver.quit()
  return urls
}

module.exports = extractURLs
