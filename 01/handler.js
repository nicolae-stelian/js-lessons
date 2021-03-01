require('dotenv').config();
const AWS = require('aws-sdk');
const axios = require('axios');
const { DbCache } = require('cache');

AWS.config.update({
  apiVersion: process.env.AWS_API_VERSION,
  region: process.env.AWS_REGION,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  accessKeyId: process.env.AWS_ACCESS_KEY,
});

const documentClient = new AWS.DynamoDB.DocumentClient();
const dbCache = new DbCache(documentClient);
const token = process.env.ARC_TOKEN;

function generateArcId(stringId) {
  const cacheKey = `generate_arc_id_`;
  const cachedId = dbCache.get(cacheKey);
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

console.log(generateArcId("test_some_string"));