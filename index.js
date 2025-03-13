const { Builder, Key, By, until } = require('selenium-webdriver');
const edge = require('selenium-webdriver/edge');
const CDP = require('chrome-remote-interface');
const { writeFileSync, appendFileSync, readFileSync } = require('fs');
const { parseAsync } = require('json2csv');
const extractURLs = require('./helpers/getHrefLinks');
const flattenObject = require('./helpers/flattenObject');
const { resolve } = require('path');


async function caputureNetworkRequests(url, port) {
  const options = new edge.Options();
  // options.addArguments('--headless')
  options.addArguments(`--remote-debugging-port=${port}`);


  const driver = await new Builder()
    .forBrowser('MicrosoftEdge')
    .setEdgeOptions(options)
    .build()

  await driver.manage().window().maximize();
  await driver.executeScript('document.body.style.zoom="25%"');

  const cdpClient = await CDP({ port });
  try {
    console.log(`Capturing network requests for url : ${url}`)
    await cdpClient.Network.enable();

    const requests = [];



    cdpClient.Network.requestWillBeSent((params) => {
      if (params?.request?.url?.includes("https://edge.adobedc.net/")) {
        console.log("request : ", params.request.url)
        try {
          const data = params
          requests.push({ url, data })
        } catch (error) {
          console.error(`error in parsing json for url - ${url} - request url - ${params.request.url} -> `, error)
          requests.push({ url, error: 'error in parsing json' })
        }
      }
    });

    cdpClient.Network.loadingFinished((params) => {
      if (params?.request?.url?.includes("https://edge.adobedc.net/")) {
        const data = params
        requests.push({ url, data })
      }
  });

  cdpClient.Network.responseReceived((params) => {
    if (params?.request?.url?.includes("https://edge.adobedc.net/")) {
      const data = params
      requests.push({ url, data })
    }
  });

    await driver.get(url);
    const link = await driver.wait(until.elementLocated(By.className('anchor4-button-link att-track btn-primary')), 10000);

    await driver.executeScript("arguments[0].scrollIntoView(true);", link);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await driver.executeScript(`
        arguments[0].setAttribute('target', '_blank');
      `,link)
    await link.click();
    await new Promise((resolve) => setTimeout(resolve, 30000));

    return requests
  } catch (err) {
    console.error(`Error for url : ${url} -> `, err);
  } finally {
    await cdpClient.close();
    await driver.close()
    await driver.quit();
  }
}


async function getData() {
  let urls = []
  readFileSync('urls.txt', 'utf-8').split('\n').forEach((url) => {
    if (url) {
      urls.push(url);
    }
  });

  const extendedURLs = []
  // for (const url of urls) {
  //   const links = await extractURLs(url)
  //   extendedURLs.push(...links)
  // }

  // https://www.business.att.com/products/wireless-plans.html

  // urls = [...urls, ...extendedURLs]
  // urls = new Set(urls)
  // urls = [...urls]
  // urls = urls.splice(0, 100)
  console.log(urls.length)
  // let batchNo = 0
  let data = []

  //concurrent
  // while (urls.length) {
  //   const batch = urls.splice(0, 6)
  //   const promises = batch.map((u, i) => {
  //     const port = 9222 + i;
  //     return caputureNetworkRequests(u, port)
  //   })

  //   console.log(`Starting to capture network requests for batch -> ${++batchNo}`)

  //   const batchData = await Promise.all(promises);
  //   data = [...data, ...batchData]
  // }

  // sequential
  for (const url of urls) {
    const port = 9222;
    const requests = await caputureNetworkRequests(url, port)
    data.push(requests)
  }

  console.log('Writing data to CSV')

  let payloads = [];
  data.forEach((reqs) => {
    if (Array.isArray(reqs) && reqs.length) {
      payloads = [...payloads, ...reqs];
    }
  });
  writeFileSync('requests.json', JSON.stringify(payloads, null, 2), 'utf-8');
  const csv = await parseAsync(payloads)
  writeFileSync('requests.csv', csv, 'utf-8')
}

getData()