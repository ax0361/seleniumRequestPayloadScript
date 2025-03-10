const { Builder } = require('selenium-webdriver');
const edge = require('selenium-webdriver/edge');
const CDP = require('chrome-remote-interface');
const { writeFileSync, appendFileSync, readFileSync } = require('fs');
const { parseAsync } = require('json2csv');


async function caputureNetworkRequests(url,port) {
  const options = new edge.Options();
  options.addArguments('--headless')
  options.addArguments(`--remote-debugging-port=${port}`); 

  const driver = await new Builder()
    .forBrowser('MicrosoftEdge')
    .setEdgeOptions(options)
    .build();

  try {
    const cdpClient = await CDP({ port });
    await cdpClient.Network.enable();

    const requests = [];
    cdpClient.Network.requestWillBeSent((params) => {
      if(params?.request?.url?.includes("interact")){
        const data = JSON.parse(params.request.postData)?.events[0].xdm
        requests.push(flattenObject({url,...data}))
      }
    });

    await driver.get(url);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await cdpClient.close();

    return requests
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await driver.quit();
  }
}
 
function flattenObject(object){
  const result = {}
  for (const key in object){
    if(typeof object[key] === 'object'){
      const flatObject = flattenObject(object[key])
      for (const flatKey in flatObject){
        result[`${key}.${flatKey}`] = flatObject[flatKey]
      }
    } else {
      result[key] = object[key]
    }
  }
  return result
}

async function extractURLs(url){
  const driver = await new Builder().forBrowser('MicrosoftEdge').build();
  driver.get(url)
  const links = await driver.findElements({tagName: 'a'})
  const urls = await Promise.all(links.map(async (link) => {
    return await link.getAttribute('href')
  }))
  return urls
}

async function getData() {
  let urls = []
  readFileSync('urls.txt', 'utf-8').split('\n').forEach((url) => {
    if (url) {
      urls.push(url);
    }
  });

  const extendedURLs = []
  for (const url of urls){
    const links = await extractURLs(url)
    extendedURLs.push(...links)
  }



  urls = [...urls, ...extendedURLs]

  console.log(urls)
  console.log(urls.length)
  const promises = urls.map((u, i) => {
    const port = 9222 + i;
    return caputureNetworkRequests(u, port)
  })

  console.log("Starting to capture network requests")

  const data = await Promise.all(promises);

  let payloads = [];
  data.forEach((reqs) => {
    if (Array.isArray(reqs) && reqs.length) {
      payloads = [...payloads, ...reqs];
    }
  });

  const csv = await parseAsync(payloads)
  writeFileSync('requests.csv',csv, 'utf-8')
}

getData()