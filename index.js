'use strict'

//Dependencies

let Promise = require('bluebird');

let seneca = require('seneca')();
let redis = require('redis');
    Promise.promisifyAll(redis.RedisClient.prototype);
    Promise.promisifyAll(redis.Multi.prototype);

let api = require('./api.js');
let config = require('./config.js');

//Class

class DatabaseController {
    constructor() {
        this.api = api;
        this.client = null;
    }

    connect(host, port) {
        return new Promise((resolve, reject) => {
            this.client = redis.createClient(port, host)
            .on('connect', () => {
                console.log('Database connected');
                resolve();
            })
            .on('error', (err) => {
                reject(err);
            })
        });
    }

    listen() {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject("Database client not defined");
            }
            seneca
              .use(this.api, {'client': this.client})
              .listen();
            console.log("API Seneca Listening");
            resolve();
        });
    }
}

//Main

let controller = new DatabaseController();

controller.connect(config.DB_HOST, config.DB_PORT)
.then(() => controller.listen());
