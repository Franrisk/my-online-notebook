// backend/db.js - 简化版
const { MongoClient } = require('mongodb');

let client = null;
let db = null;
let collection = null;
let isConnected = false;

async function connect() {
    try {
        const uri = process.env.MONGODB_URI;
        console.log('🔄 正在连接MongoDB...');

        if (!uri) {
            throw new Error('请设置MONGODB_URI环境变量');
        }

        client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000
        });

        await client.connect();
        console.log('✅ MongoDB连接成功');

        // 测试连接
        await client.db('admin').command({ ping: 1 });

        db = client.db('notes_app');
        collection = db.collection('notes');
        isConnected = true;

        console.log('✅ 使用数据库: notes_app');
        console.log('✅ 使用集合: notes');

        return { client, db, collection };

    } catch (error) {
        console.error('❌ 数据库连接失败:', error.message);

        // 清理
        if (client) {
            try {
                await client.close();
            } catch (e) {
                console.log('关闭连接时出错:', e.message);
            }
        }

        client = null;
        db = null;
        collection = null;
        isConnected = false;

        throw error;
    }
}

function getCollection() {
    if (!isConnected) {
        throw new Error('数据库未连接');
    }
    return collection;
}

async function healthCheck() {
    try {
        if (!isConnected || !client) {
            return false;
        }
        await client.db('admin').command({ ping: 1 });
        return true;
    } catch {
        return false;
    }
}

async function close() {
    if (client) {
        await client.close();
        isConnected = false;
    }
}

module.exports = {
    connect,
    getCollection,
    healthCheck,
    close
};
