// backend/db.js - 适配Vercel和本地
const { MongoClient } = require('mongodb');

class Database {
    constructor() {
        this.client = null;
        this.db = null;
        this.collection = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            const uri = process.env.MONGODB_URI;

            if (!uri) {
                throw new Error('MONGODB_URI environment variable is not set');
            }

            console.log('🔄 Connecting to MongoDB...');

            // 优化连接选项
            const clientOptions = {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                maxPoolSize: 10,
                retryWrites: true,
                w: 'majority'
            };

            this.client = new MongoClient(uri, clientOptions);

            // 连接
            await this.client.connect();
            console.log('✅ MongoDB client connected');

            // 验证连接
            await this.client.db('admin').command({ ping: 1 });
            console.log('✅ MongoDB ping successful');

            // 获取数据库和集合
            this.db = this.client.db('notes_app');
            this.collection = this.db.collection('notes');

            // 确保集合存在并创建索引
            const collections = await this.db.listCollections({ name: 'notes' }).toArray();
            if (collections.length === 0) {
                console.log('📝 Creating notes collection...');
                await this.db.createCollection('notes');
            }

            // 创建索引
            await this.collection.createIndex({ createdAt: -1 });
            console.log('✅ Index created/verified');

            this.isConnected = true;
            console.log('🎉 Database connection fully established');

            return this.db;

        } catch (error) {
            console.error('❌ Database connection failed:', error.message);

            // 清理资源
            if (this.client) {
                try {
                    await this.client.close();
                } catch (closeError) {
                    console.log('Error closing connection:', closeError.message);
                }
            }

            this.client = null;
            this.db = null;
            this.collection = null;
            this.isConnected = false;

            throw error;
        }
    }

    getCollection() {
        if (!this.isConnected) {
            throw new Error('Database is not connected. Call connect() first.');
        }
        return this.collection;
    }

    async healthCheck() {
        try {
            if (!this.isConnected || !this.client) {
                return false;
            }
            await this.client.db('admin').command({ ping: 1 });
            return true;
        } catch (error) {
            console.log('Health check failed:', error.message);
            return false;
        }
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.isConnected = false;
            console.log('🔒 Database connection closed');
        }
    }
}

const database = new Database();

module.exports = {
    connect: () => database.connect(),
    getCollection: () => database.getCollection(),
    healthCheck: () => database.healthCheck(),
    close: () => database.close()
};
