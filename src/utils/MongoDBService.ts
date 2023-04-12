import * as mongo from "mongodb"

const mongoUrl = import.meta.env.MONGO_URL || ""
const mongoDbName = import.meta.env.MONGO_DB_NAME || ""

class MongoDBService {
  private client: mongo.MongoClient
  private db: mongo.Db

  private static instance: MongoDBService

  private constructor(private uri: string, private dbName: string) {
    this.client = new mongo.MongoClient(this.uri)
    this.db = null
  }

  public static getInstance(): MongoDBService {
    if (!MongoDBService.instance) {
      MongoDBService.instance = new MongoDBService(mongoUrl, mongoDbName)
    }
    return MongoDBService.instance
  }

  public async connect(): Promise<void> {
    await this.client.connect()
    this.db = this.client.db(this.dbName)
  }

  public async disconnect(): Promise<void> {
    await this.client.close()
  }

  public async insertOne(
    collectionName: string,
    document: object
  ): Promise<mongo.InsertOneWriteOpResult<any>> {
    const collection = this.db.collection(collectionName)
    return await collection.insertOne(document)
  }

  public async find(
    collectionName: string,
    query: object = {},
    options: object = {}
  ): Promise<any[]> {
    const collection = this.db.collection(collectionName)
    return await collection.find(query, options).toArray()
  }

  //根据deviceId查看当天的count数
  public async countRecordsByIpAndChatTime(
    collectionName: string,
    ip: string
  ): Promise<number> {
    const collection = this.db.collection(collectionName)

    // 构建查询条件
    const today = new Date()
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )
    const endOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    )
    const query = {
      ip_address: ip,
      chat_time: {
        $gte: startOfToday,
        $lt: endOfToday
      }
    }

    // 使用 countDocuments 方法获取满足条件的文档数量，并将结果返回
    const result = await collection.countDocuments(query)
    return result
  }

  //根据deviceId查看当天的count数
  public async countRecordsByDeviceIdAndChatTime(
    collectionName: string,
    deviceId: string
  ): Promise<number> {
    const collection = this.db.collection(collectionName)

    // 构建查询条件
    const today = new Date()
    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    )
    const endOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    )
    const query = {
      device_id: deviceId,
      chat_time: {
        $gte: startOfToday,
        $lt: endOfToday
      }
    }

    // 使用 countDocuments 方法获取满足条件的文档数量，并将结果返回
    const result = await collection.countDocuments(query)
    return result
  }

  public async findOne(
    collectionName: string,
    query: object = {},
    options: object = {}
  ): Promise<any> {
    const collection = this.db.collection(collectionName)
    return await collection.findOne(query, options)
  }

  public async updateOne(
    collectionName: string,
    query: object,
    update: object
  ): Promise<mongo.UpdateWriteOpResult> {
    const collection = this.db.collection(collectionName)
    return await collection.updateOne(query, update)
  }

  public async deleteOne(
    collectionName: string,
    query: object
  ): Promise<mongo.DeleteWriteOpResultObject> {
    const collection = this.db.collection(collectionName)
    return await collection.deleteOne(query)
  }
}

export default MongoDBService
