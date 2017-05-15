/*jslint node: true */
/*jshint esversion: 6 */
'use strict';

//Dependencies

const Promise = require('bluebird');  //jshint ignore:line

const redis = require('redis');
    Promise.promisifyAll(redis.RedisClient.prototype);
    Promise.promisifyAll(redis.Multi.prototype);

const mongo = require('mongodb');
    Promise.promisifyAll(mongo);

const core = require('mms-core');
const config = require('./config.js');
const serviceAPI = require('./api/service/module.js');
const serverAPI = require('./api/server/module.js');

//Class
let dbMongo = null;    //TODO not global but inside class

class DatabaseController {
    constructor() {
        this.node = "NODE_DB_CONTROLLER";
        this.clientRedis = null;   //need to manually connect because async
        this.service = null;    //need to manually attach because previous action is async
	//this.server = new core.Server(this.node, serverAPI, {"service": this.service})
        this.serviceAPI = serviceAPI;
	      this.serverAPI = serverAPI;
    }

    attachService() {
        return new Promise( (resolve, reject) => {
            if (!this.clientRedis || !dbMongo) {
                reject("Redis or Mongo db clients not connected");
            }

            this.service = new core.Service(this.node, this.serviceAPI, {"clientRedis": this.clientRedis, 'dbMongo': dbMongo});
	    console.log("Service attached");
            resolve();
        });
    }

   attachServer() {
        return new Promise( (resolve, reject) => {
            if (!this.clientRedis || !dbMongo) {
                reject("Redis or Mongo db clients not connected");
            }

            this.server = new core.Server(this.node, this.serverAPI, {"clientRedis": this.clientRedis, 'dbMongo': dbMongo});
	    console.log("Server attached");
            resolve();
        });
    }

    connectRedis(redisHost, redisPort, mongoHost, mongoPort) {
        return new Promise((resolve, reject) => {
            this.clientRedis = redis.createClient(redisPort, redisHost)
                .on('connect', () => {
                    console.log('Redis database connected');
                    resolve();
                })
                .on('error', (err) => {
                    reject(err);
                });
        });
    }

    connectMongo(mongoHost, mongoPort) {
        return new Promise((resolve, reject) => {
            mongo.MongoClient.connect(`mongodb://${config.DB_MONGODB_HOST}:${config.DB_MONGODB_PORT}/static`, (err, db) => {
                if (err) {
                    reject();
                }
                dbMongo = db;
                resolve();
            });
        });
    }
}

//Main

let controller = new DatabaseController();

controller.connectRedis(config.DB_REDIS_HOST, config.DB_REDIS_PORT)
.then(() => controller.connectMongo(config.DB_MONGO_HOST, config.DB_MONGO_PORT))
.then(() => {
    controller.attachService();
    controller.attachServer();
})
.then(() => controller.service.listen())
.then(() => controller.server.listen());
