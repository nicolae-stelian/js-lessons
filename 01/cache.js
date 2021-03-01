class DbCache {
  constructor(docClient) {
    this.docClient = docClient; // AWS.DynamoDB.DocumentClient.
    this.tableName = 'cacheTable';
  }

  set(key, value) {
    const parameters = {
      TableName: this.tableName,
      Item: {
        id: key.toString(),
        value: JSON.stringify(value),
      },
    };
    return this.docClient.put(parameters).promise();
  }

  get(key) {
    const parameters = {
      TableName: this.tableName,
      Key: { id: key },
    };
    return this.docClient.get(parameters).promise()
      .then((result) => {
        if (result && result.Item && result.Item.value) {
          return JSON.parse(result.Item.value.toString());
        }
        return {};
      });
  }
}

module.exports = {
  DbCache,
};
