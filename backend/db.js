// db.js - 简化稳定版本
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
                console.error('❌ MONGODB_URI未设置');
                throw new Error('MONGODB_URI未设置');
            }

            console.log('🔄 连接数据库...');
            
            // 最简化的连接配置
            this.client = new MongoClient(uri, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                // Vercel环境下让MongoDB驱动自动处理TLS
            });

            await this.client.connect();
            
            // 测试连接
            await this.client.db('admin').command({ ping: 1 });
            
            this.db = this.client.db('notes_app');
            this.collection = this.db.collection('notes');
            this.isConnected = true;
            
            console.log('✅ 数据库连接成功');
            return this.db;
            
        } catch (error) {
            console.error('❌ 数据库连接失败:', error.message);
            // 打印详细错误信息
            console.error('完整错误:', error);
            throw error;
        }
    }

    getCollection() {
        if (!this.isConnected) {
            throw new Error('数据库未连接');
        }
        return this.collection;
    }

    async healthCheck() {
        try {
            if (!this.isConnected) return false;
            await this.client.db('admin').command({ ping: 1 });
            return true;
        } catch {
            return false;
        }
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.isConnected = false;
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
