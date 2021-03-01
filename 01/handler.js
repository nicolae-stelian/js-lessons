require('dotenv').config();
// /usr/bin/node /home/stelu/learning-workspace/js-lessons/01/handler.js

const AWS = require('aws-sdk');
const axios = require('axios');
const { DbCache } = require('./cache');

let config = {
  apiVersion: process.env.AWS_API_VERSION,
  region: `${process.env.AWS_REGION}`,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  accessKeyId: process.env.AWS_ACCESS_KEY,
};
// console.log(config);
AWS.config.update(config);

const documentClient = new AWS.DynamoDB.DocumentClient();
const dbCache = new DbCache(documentClient);
const token = process.env.ARC_TOKEN;

const generateArcId = async (stringId) => {
  const cacheKey = `generate_arc_id_`;
  // const cachedId = dbCache.get(cacheKey);
  const cachedId = await dbCache.get(cacheKey);
  if (cachedId && cachedId.length > 0) {
    return cachedId;
  }

  const url = `https://api.sandbox.prisaradio.arcpublishing.com/draft/v1/arcuuid?id=${stringId}`;
  const options = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  return axios.get(url, options).then((resp) => {
    if (!resp.data.id) {
      return false;
    }
    dbCache.set(cacheKey, resp.data.id);
    return resp.data.id;
  });
}

generateArcId('some_string_to_id').then(r => {
  console.log(r);
});


// dbCache.set('some_key', 'some_value');

// const v =  dbCache.get('some_key');
// Promise.all([v]).then((values) => {
//   console.log(values);
// });

