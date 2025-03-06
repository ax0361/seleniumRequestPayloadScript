const { Builder } = require('selenium-webdriver');
const edge = require('selenium-webdriver/edge');
const CDP = require('chrome-remote-interface');
const { writeFileSync, appendFileSync, readFileSync } = require('fs');
const { parseAsync } = require('json2csv');


async function caputureNetworkRequests(url) {
  const options = new edge.Options();
  // options.addArguments('--headless')
  options.addArguments('--remote-debugging-port=9222'); 

  const driver = await new Builder()
    .forBrowser('MicrosoftEdge')
    .setEdgeOptions(options)
    .build();

  try {
    const cdpClient = await CDP({ port: 9222 });
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

async function getData() {
  const requests = [];
  const urls = []
  readFileSync('urls.txt', 'utf-8').split('\n').forEach((url) => {
    if (url) {
      urls.push(url);
    }
  });
  let payloads = []
  for (const url of urls){
    const reqs = await caputureNetworkRequests(url)
    if(Array.isArray(reqs) && reqs.length){
      payloads = [...payloads,...reqs]
    }
  } 

  const csv = await parseAsync(payloads)
  writeFileSync('requests.csv',csv, 'utf-8')
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

getData()