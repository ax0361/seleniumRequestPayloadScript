const { Builder, Key, By, until } = require('selenium-webdriver');
const edge = require('selenium-webdriver/edge');
const CDP = require('chrome-remote-interface');
const { writeFileSync, appendFileSync, readFileSync, readSync } = require('fs');
const { parseAsync } = require('json2csv');
const extractURLs = require('./helpers/getHrefLinks');
const flattenObject = require('./helpers/flattenObject');


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



    cdpClient.Network.requestWillBeSent(async (params) => {
      if (params?.request?.url?.includes("https://edge.adobedc.net/")) {
        console.log("request : ", params.request.url)
        try {
          const data = await cdpClient.Network.getRequestPostData({ requestId: params.requestId })
          const postData = JSON.parse(data?.postData)
          requests.push({ url: params.request.url, data: postData.events[0]?.xdm })
        } catch (error) {
          console.error(`error in parsing json for url - ${url} - request url - ${params.request.url} -> `, error)
          requests.push({ url, error: 'error in parsing json' })
        }
      }
    });



    await driver.get(url);
    await driver.executeScript('window.open = null')
    const originalTab = await driver.getWindowHandle();

    let links = (await driver.findElements({ tagName: "a" })).splice(0, 10);
    console.log("Links length => ", links.length)
    while (links.length) {
      const batch = links.splice(0, 6)
      await Promise.all(batch.map(async (link) => {
        try {
          await driver.executeScript(`arguments[0].setAttribute('target', '_blank');`, link)
          await link.click();
        } catch (error) {
          const l = await link.getAttribute("href")
          console.log(`error in clicking the link -> ${l} -> `, error)
        }
      }))


      const tabs = await driver.getAllWindowHandles();
      for (const tab of tabs) {
        if (tab !== originalTab) {
          try {
            await driver.switchTo().window(tab);
            await driver.close();
          } catch (error) {
            console.error(`error in closing tab -> ${tab} -> `, error)
          }
        }
      }
    }




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