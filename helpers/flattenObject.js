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

module.exports = flattenObject