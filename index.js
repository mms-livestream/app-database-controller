/*jslint node: true */
/*jshint esversion: 6 */
'use strict';

//Dependencies

let Promise = require('bluebird');  //jshint ignore:line

let redis = require('redis');
    Promise.promisifyAll(redis.RedisClient.prototype);
    Promise.promisifyAll(redis.Multi.prototype);

let core = require('mms-core');
let config = require('./config.js');
let serviceAPI = require('./api/service/plugin.js');

//Class

class DatabaseController {
    constructor() {
        this.node = "NODE_DB_CONTROLLER";
        this.clientDB = null;   //need to manually connect because async
        this.service = null;    //need to manually attach because previous action is async
        this.serviceAPI = serviceAPI;
    }

    attachService() {
        return new Promise( (resolve, reject) => {
            if (!this.clientDB) {
                reject("Database client not connected");
            }

            this.service = new core.Service(this.node, this.serviceAPI, {"clientDB": this.clientDB});
            resolve();
        });
    }

    connect(host, port) {
        return new Promise((resolve, reject) => {
            this.clientDB = redis.createClient(port, host)
            .on('connect', () => {
                console.log('Database connected');
                resolve();
            })
            .on('error', (err) => {
                reject(err);
            });
        });
    }
}

//Main

let controller = new DatabaseController();

controller.connect(config.DB_HOST, config.DB_PORT)
.then(() => controller.attachService())
.then(() => controller.service.listen());
