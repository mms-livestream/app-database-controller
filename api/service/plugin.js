/*jslint node: true */
/*jshint esversion: 6 */
'use strict';

//Dependencies

const Promise = require('bluebird');  //jshint ignore:line

const moment = require('moment');
const crypto = Promise.promisifyAll(require('crypto'));

const cryptoConfig = {
    iterations: 10000,
    keylen: 512,
    digest: 'sha512'
};

function hashPassword(password, salt) {
    return new Promise((resolve, reject) => {
        salt = (typeof salt === "undefined") ? crypto.randomBytes(128).toString('base64') : salt;   //define salt if not defined already, overloading functions
        let hash = crypto.pbkdf2Async(password, salt, cryptoConfig.iterations, cryptoConfig.keylen, cryptoConfig.digest)
        .then((key) => {
            resolve({
                hash: key.toString('hex'),
                salt: salt
            });
        })
        .catch(err => reject(err));
    });
}

//API

module.exports = function (options) {

    //Database client attached
    const clientRedis = options.clientRedis;
    const dbMongo = options.dbMongo;

    /**
     * Add new viewer to cache database
     * @function
     * @param {JSON object} msg - information about new viewer : { "id_viewer": int, "id_uploader": int }
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
    this.add('role:viewer,cmd:add', (msg, respond) => {
        let validation = new Promise((resolve, reject) => {
            if (msg.id_viewer < 0) {    //TODO improve validation with validate.js
                return reject(new Error("Error on viewerID"));
            }
            if (msg.id_uploader < 0) {
                return reject(new Error("Error on uploaderID"));
            }
            resolve();
        });

        validation.then(() => clientRedis.hmsetAsync(`viewer:${msg.id_viewer}`, {
            "id_uploader": msg.id_uploader,
            "date_started": moment().format() }))  //date format moment.js ISO : '2016-08-02T15:44:09-05:00'
        .then(() => {return clientRedis.lpushAsync(`viewer:${msg.id_viewer}:servers`, ['TODO myserver1', 'myserver2']); } )   //add default list of servers for this session
        .then(() => {return new Promise( (resolve, reject) => {respond(null, { 'code': 200 , 'status': "Viewer added succesfully." }); resolve();}, null );} )
        .catch(err => {
            respond(`Error on adding viewer: ${err}`, { 'code': 500 , 'status': null });
        });
    });

    /**
     * Delete viewer from cache database
     * @function
     * @param {JSON object} msg - information : { "id_viewer": int }
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
    this.add('role:viewer,cmd:del', (msg, respond) => {
      respond(null, { 'status': 'OK del' });
    });

    /**
     * Add new uploader to cache database
     * @function
     * @param {JSON object} msg - information about new uploader : { "id_uploader": int, "title": string , "tags": string array}
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
     this.add('role:uploader,cmd:add', (msg, respond) => {
         let validation = new Promise((resolve, reject) => {
            if (msg.id_uploader < 0) {
                return reject(new Error("Error on viewerID"));
            }
            if (msg.title.length === 0) {
                return reject(new Error("Error on uploaderID"));
            }
            //TODO : test if msg.tags : string array
            resolve();
        });

        validation.then(() => clientRedis.hmsetAsync(`uploader:${msg.id_uploader}`, {
            "title": msg.title }))  //date format moment.js ISO : '2016-08-02T15:44:09-05:00'
        .then(() => {return clientRedis.lpushAsync(`uploader:${msg.id_uploader}:tags`, msg.tags); } )   //add tags, array form
        .then(() => {return new Promise( () => respond(null, { 'code': 200 , 'status': "Uploader added succesfully." }), null );} )
        .catch(err => {
            respond(`Error on adding uploader: ${err}`, { 'code': 500 , 'status': null });
        });
     });

    /**
     * Delete uploader from cache database
     * @function
     * @param {JSON object} msg - information : { "id_uploader": int }
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
    this.add('role:uploader,cmd:del', (msg, respond) => {
      respond(null, { 'status': 'OK del' });
    });

    /**
     * Compute number of viewers for each video
     * @function
     * @param {JSON object} msg - information about new viewer : { "id_viewer": int, "id_uploader": int }
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
    // this.add('role:viewers,cmd:stats', (msg, respond) => {
    //     let validation = new Promise((resolve, reject) => {
    //         resolve();
    //     });
    //
    // 	let counters={};
    // 	validation.then(() => clientDB.scan('0','MATCH','viewers:*','count','10', (err, viewers) => {
    //         let multi = clientDB.multi();
    //
    // 	    for (var v in viewers[1]) {
    //             multi.hget(viewers[1][v], 'id_uploader');
    //             /*
    // 	        multi.hget(viewers[1][v], 'id_uploader', (err,vid) => {
    // 	       	    if (counters["uploader:"+vid] === undefined) {
    // 		            counters["uploader:"+vid] = 1;
    // 		            console.log(counters);
    // 		        } else {
    // 		            counters["uploader:"+vid] +=1;
    // 		            console.log(counters);
    // 		        }
    // 		    });*//*
    //             if (v == viewers[1].length){
    //                 return(counters);
    //             }*/
    //         }
    //         multi.exec((err, res) => {
    //             console.log(res);
    //         });
    //
    //         //viewers[1].
    // 	}))
    //     //.then(() => console.log(counters))
    //     .then(() => {return new Promise( (resolve, reject) => {respond(null, { 'code': 200 , 'status': "Number of viewers counted succesfully." }); resolve();}, null );} )
    //     .catch(err => {
    //         respond(`Error on counting viewers: ${err}`, { 'code': 500 , 'status': null });
    //     });
    // });

     /**
     * Compute servers load
     * @function
     * @param {JSON object} msg - information about new viewer : { "id_viewer": int, "id_uploader": int }
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */

    /*
    this.add('role:servers,cmd:stats', (msg, respond) => {
        let validation = new Promise((resolve, reject) => {
            resolve();
        });

	    let counters2={};
	    validation.then(() => clientDB.scanAsync('0','MATCH','servers:viewer:*','count','20', (err, servers) => {
	        for (var v in servers[1]){
                clientDB.lrangeAsync(servers[1][v], '0', '-1', (err, srvlist) => {
	       	        for (var s in srvlist){
		                if (counters2[srvlist[s]] === undefined){
		                    counters2[srvlist[s]] = 1;
		       	            console.log(counters2);
		                }else{
		                    counters2[srvlist[s]] +=1;
		                    console.log(counters2);
		                }
		            }
	            })
            }//console.log(counters2);
        }))


        .then(() => {return new Promise( (resolve, reject) => {respond(null, { 'code': 200 , 'status': "Servers load counted succesfully." }); resolve();}, null );} )
        .catch(err => {
            respond(`Error on counting servers load: ${err}`, { 'code': 500 , 'status': null });
        });
    });*/


    /**
     * Add a new user
     * @function
     * @param {JSON object} msg - information : { "username": string, "password": hash string }
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
    this.add('role:users,cmd:add', (msg, respond) => {
        let validation = new Promise((resolve, reject) => {
           //TODO
           resolve();
       });

       validation.then(() => {return hashPassword(msg.password);})   //adds random salt
       .then((cryptoPassword) => {return dbMongo.collection('users').insertAsync({'username': msg.username, 'password': cryptoPassword.hash, 'salt': cryptoPassword.salt, 'email': msg.email});})
       .then(respond(null, { 'code': 200 , 'status': "User added succesfully."}))
       .catch(err => {
          respond(`Error on add user: ${err}`, { 'code': 500 , 'status': null });
        });
    });

    /**
     * Authenticate a user
     * @function
     * @param {JSON object} msg - information : { "username": string, "password": hash string }
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
    this.add('role:users,cmd:authenticate', (msg, respond) => {
        let validation = new Promise((resolve, reject) => {
           //TODO
           resolve();
        });

        let user = null;
        validation.then(() => {return dbMongo.collection('users').findOneAsync({'username': msg.username});})
        .then((resultDB) => {
            user = resultDB;
            if (user === null) {
                respond(null, { 'code': 200 , 'status': "Authentication failed.", 'data': {'authenticated': false}});
            }
        })
        .then(() => {return hashPassword(msg.password, user.salt);})
        .then((cryptoPassword) => {
            if (user.password === cryptoPassword.hash) {
                respond(null, { 'code': 200 , 'status': "Authenticated succesfully.", 'data': {'authenticated': true} });
            }
            else {
                respond(null, { 'code': 200 , 'status': "Authentication failed.", 'data': {'authenticated': false}});
            }
        })
        .catch(err => {
           respond(`Error on authentication: ${err}`, { 'code': 500 , 'status': null });
       });
    });

    

};
