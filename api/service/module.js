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

        validation.then(() =>{ clientRedis.hmsetAsync(`viewer:${msg.id_viewer}`, {
            "id_uploader": msg.id_uploader,
            "date_started": moment().format() });  //date format moment.js ISO : '2016-08-02T15:44:09-05:00'
			clientRedis.set('modifViewer',"yes"); })
        .then(() => {return clientRedis.lpushAsync(`viewer:${msg.id_viewer}:servers`, []); } )   //add default list of servers for this session
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

        //Add uploader
        let promAdd = validation.then(() => clientRedis.hmsetAsync(`uploader:${msg.id_uploader}`, {
            "title": msg.title, "publishTime": new Date()}))  //date format
        .then(() => {return clientRedis.lpushAsync(`uploader:${msg.id_uploader}:tags`, msg.tags); } )   //add tags, array form
        .then(() => {return new Promise( () => respond(null, { 'code': 200 , 'status': "Uploader added succesfully." }), null );} )
        .catch(err => {
            respond(`Error on adding uploader: ${err}`, { 'code': 500 , 'status': null });
        });

        //Update videos for session manager
        //promAdd.then(() => )
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

       console.log(msg);

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
              respond(null, { 'code': 200 , 'status': "Authenticated succesfully.", 'data': {'authenticated': true,  'id': user._id.toString(), 'username': user.username} });
            }
            else {
                respond(null, { 'code': 200 , 'status': "Authentication failed.", 'data': {'authenticated': false}});
            }
        })
        .catch(err => {
           respond(`Error on authentication: ${err}`, { 'code': 500 , 'status': null });
       });
    });

    /**
     * Compute number of viewers for each video
     * @function
     * @param {JSON object} msg - no information
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
    this.add('role:viewers,cmd:stats', (msg, respond) => {
        let validation = new Promise((resolve, reject) => {
            resolve();
        });
		let multi=clientRedis.multi();
		let counters={};
		validation.then(() => clientRedis.scanAsync('0','MATCH','viewer:*','count','100000'))// 100000 should always be bigger if there are more viewers
	    .then((viewers) => {
			for (let v in viewers[1]){
				if (viewers[1][v].indexOf(":servers") == -1){
			 	    multi.hget(viewers[1][v], 'id_uploader', (err,vid) => {
		 	  	    	if (counters["uploader:"+vid] === undefined){
		  		      		counters["uploader:"+vid] = 1;
						}else{
		  		      		counters["uploader:"+vid] +=1;
		   		    	}
					});
				}
   			}
		})
		.then(() => {
			multi.execAsync((err,res) => {
				return new Promise( (resolve, reject) => {respond(null, { 'counters': counters,'code': 200 , 'status': "Number of viewers counted succesfully." }); resolve();}, null );
			});
		})
        //.then(() => {return new Promise( (resolve, reject) => {respond(null, { 'code': 200 , 'status': "Number of viewers counted succesfully." }); resolve();}, null );} )
        .catch(err => {
            respond(`Error on counting viewers: ${err}`, { 'code': 500 , 'status': null });
        });
    });

	/**
     * Compute servers load
     * @function
     * @param {JSON object} msg - no information
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
    this.add('role:servers,cmd:stats', (msg, respond) => {
      let validation = new Promise((resolve, reject) => {
          resolve();
      });
  		let multi = clientRedis.multi();
  		let counters2={};
  		validation.then(() => clientRedis.scanAsync('0','MATCH','viewer:*:servers','count','100000'))
  	    .then((servers) => {
  			for (let v in servers[1]){
                  multi.lrange(servers[1][v], '0', '-1', (err, srvlist) => {
  	       	    	for (let s in srvlist){
  		       			if (counters2[srvlist[s]] === undefined){
  		            		counters2[srvlist[s]] = 1;
  		        		}else{
  		            		counters2[srvlist[s]] +=1;
  		        		}
  		    		}
  	    		});
  			}
  		})
  		.then(() => {
  			multi.execAsync((err,res) => {
  				return new Promise( (resolve, reject) => {respond(null, { 'counters':counters2,'code': 200 , 'status': "Server load counted succesfully." }); resolve();}, null );
  			});
  		})
      //.then(() => {return new Promise( (resolve, reject) => {respond(null, { 'code': 200 , 'status': "Servers load counted succesfully." }); resolve();}, null );} )
      .catch(err => {
          respond(`Error on counting servers load: ${err}`, { 'code': 500 , 'status': null });
      });
    });

	/**
     * Update the servers for each video
     * @function
     * @param {JSON object} msg - information about new update about replication decision : { "distribution": object(JSON)}
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
     this.add('role:uploader_servers,cmd:update', (msg, respond) => {
         let validation = new Promise((resolve, reject) => {
            //TODO : test if msg.distribution : object
            resolve();
        });
		let multi = clientRedis.multi();
		validation.then(() => {for (let i in msg.distribution){
			multi.del(i+":servers");
			for (let j in msg.distribution[i]){
		    	multi.lpush(i+":servers", msg.distribution[i][j]);
			}
    	} })
		.then(() => {
                multi.execAsync((err,res) => {
			        return new Promise( (resolve, reject) => {respond(null, {'code': 200 , 'status': "Uploader servers updated succesfully." }); resolve();}, null );
            });
		})
	    .catch(err => {
            respond(`Error on updating uploader servers: ${err}`, { 'code': 500 , 'status': null });
        });
     });

	/**
     * Update the servers for each viewer
     * @function
     * @param {JSON object} msg - information about new update about replication decision : { "distribution": object(JSON)}
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
     this.add('role:viewer_servers,cmd:update', (msg, respond) => {
         let validation = new Promise((resolve, reject) => {
            //TODO : test if msg.distribution : object
            resolve();
        });
		let multi = clientRedis.multi();
		validation.then(() => {for (let i in msg.distribution){

			multi.del("viewer:"+i+":servers");
			for (let j in msg.distribution[i]["servers"]){
		    		multi.lpush("viewer:"+i+":servers", msg.distribution[i]["servers"][j]);
			}
    	} })
		.then(() => {
                multi.execAsync((err,res) => {
			        return new Promise( (resolve, reject) => {respond(null, {'code': 200 , 'status': "viewer servers updated succesfully." }); resolve();}, null );
            });
		})
	    .catch(err => {
            respond(`Error on updating viewer servers: ${err}`, { 'code': 500 , 'status': null });
        });
     });

	    /**
        * Get the servers for each video
        * @function
        * @param {JSON object} msg - None
        * @param {function} respond - response after operation : respond(err, JSON object response);
        */
        this.add('role:uploader_servers,cmd:get', (msg, respond) => {
            let validation = new Promise((resolve, reject) => {
               resolve();
           });
		         let lists = {}
        let multi = clientRedis.multi();
        validation.then(() => clientRedis.scanAsync('0','MATCH','uploader:*:servers','count','100000'))
        .then((srv_ups) => {for (let i in srv_ups[1]){
			multi.lrange(srv_ups[1][i], '0', '-1', (err, res) => {
				let slices = srv_ups[1][i].split(":");
				lists[slices[0]+":"+slices[1]]=res;
			});
   	      }
        })
   		.then(() => {multi.execAsync((err,res) => {
   			return new Promise( (resolve, reject) => {respond(null, {'lists':lists, 'code': 200 , 'status': "Uploader servers updated succesfully." }); resolve();}, null );
   			})
   		})
   	    .catch(err => {
               respond(`Error on updating uploader servers: ${err}`, { 'code': 500 , 'status': null });
           });
        });
	/**
     * List of viewers for each video
     * @function
     * @param {JSON object} msg - no information
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
    this.add('role:viewers,cmd:list', (msg, respond) => {
        let validation = new Promise((resolve, reject) => {
            resolve();
        });
		let multi=clientRedis.multi();
		let lists={};

		validation.then(() => clientRedis.scanAsync('0','MATCH','viewer:*','count','100000'))// 100000 should always be bigger if there are more viewers
	    .then((viewers) => {
			for (let v in viewers[1]) {
				if (viewers[1][v].indexOf(":servers") == -1){
		 	    	multi.hget(viewers[1][v], 'id_uploader', (err,vid) => {
						if (lists["uploader:".concat(vid)] == undefined) {
							lists["uploader:".concat(vid)] = {};
							lists["uploader:".concat(vid)]["viewers"] = [];
							lists["uploader:".concat(vid)]["viewers"] = lists["uploader:".concat(vid)]["viewers"].concat(viewers[1][v]);
						}else
							lists["uploader:".concat(vid)]["viewers"] = lists["uploader:".concat(vid)]["viewers"].concat(viewers[1][v]);
					})
				}
   			}
		})
		.then(() => {
			multi.execAsync((err,res) => {
				return new Promise( (resolve, reject) => {respond(null, { 'lists': lists,'code': 200 , 'status': "List of viewers done succesfully." }); resolve();}, null );
			});
		})
        .catch(err => {
            respond(`Error on listing viewers: ${err}`, { 'code': 500 , 'status': null });
        });
    });

	/**
     * video publishTime
     * @function
     * @param {JSON object} msg - uploader
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
	this.add('role:publishTime,cmd:get', (msg, respond) => {
        let validation = new Promise((resolve, reject) => {
            resolve();
        });
		let publishTime = {};
		let upsv=[];
		let multi=clientRedis.multi();
		validation.then(() => clientRedis.scanAsync('0','MATCH','uploader:*','count','100000')) // ? to be modified if there are >= 10 ups
	    .then((uploaders) => {
			for (let i in uploaders[1]){
				if (uploaders[1][i].indexOf(":servers") == -1 && uploaders[1][i].indexOf(":tags") == -1)
					upsv = upsv.concat(uploaders[1][i]);
			}
			return(upsv);
		})
		.then((upsv) => { for (let i in upsv) { 
			multi.hget(upsv[i], "publishTime", (err,pubTime) => {
				publishTime[upsv[i]] = pubTime;
			})
		}	})
		.then(() => {
			multi.execAsync((err,res) => {
				return new Promise( (resolve, reject) => {respond(null, { 'publishTime': publishTime,'code': 200 , 'status': "publishTime returned succesfully." }); resolve();}, null );
			})
		})
        .catch(err => {
            respond(`Error on returning publishTime: ${err}`, { 'code': 500 , 'status': null });
        });
    });

	/**
     * get the list of the uploaders
     * @function
     * @param {JSON object} msg - no information
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
    this.add('role:uploaders,cmd:list', (msg, respond) => {
        let validation = new Promise((resolve, reject) => {
            resolve();
        });

		let upsv=[];
		validation.then(() => clientRedis.scanAsync('0','MATCH','uploader:*','count','100000')) // ? to be modified if there are >= 10 ups
	    .then((uploaders) => {
			for (let i in uploaders[1]){
				if (uploaders[1][i].indexOf(":servers") == -1 && uploaders[1][i].indexOf(":tags") == -1)
					upsv = upsv.concat(uploaders[1][i]);
			}
			return(upsv);
		})

		.then((upsv) => {
			return new Promise( (resolve, reject) => {respond(null, { 'uploaders':[upsv],'code': 200 , 'status': "uploaders listed succesfully." }); resolve();}, null );
			})

        .catch(err => {
            respond(`Error on listing uploaders : ${err}`, { 'code': 500 , 'status': null });
        });
	});

	/**
     * get an object of the distribution servers with their bitrates
     * @function
     * @param {JSON object} msg - no information
     * @param {function} respond - response after operation : respond(err, JSON object response);
     */
    this.add('role:servers,cmd:bitrates', (msg, respond) => {
        let validation = new Promise((resolve, reject) => {
            resolve();
        });

		let bitrate={};
		validation.then(() => {return clientRedis.hgetallAsync('distrib');})
	    .then((result) => {
			for (let i=1; i<result.length; i=i+2){
				bitrate[result[i-1]] = result[i];
			}
			return(bitrate);
		})

		.then((bitrate) => {
			return new Promise( (resolve, reject) => {respond(null, { 'bitrate':bitrate,'code': 200 , 'status': "Bitrate object created." }); resolve();}, null );
		})

        .catch(err => {
            respond(`Error on creating bitrate object : ${err}`, { 'code': 500 , 'status': null });
        });
	});

	/**
     * Verify if a viewer is added or removed
     * @function
     * @param {JSON object} msg - no information
     * @param {function} respond - response after operation : respond(err, string response);
     */
    this.add('role:modif,cmd:verif', function (msg, respond) {
        let validation = new Promise((resolve, reject) => {
            resolve();
        });

		validation.then(() => { clientRedis.get('modifViewer', (err, res) => {
			if (err){
				throw err;
			}
			if (res == "yes")
				clientRedis.set('modifViewer',"no");
			return new Promise( (resolve, reject) => {respond(null, { 'modification':res,'code': 200 , 'status': "Bitrate object created." }); resolve();}, null );
		})	})

        .catch(err => {
            respond(`Error on creating bitrate object : ${err}`, { 'code': 500 , 'status': null });
        });
	});




// Noellie
let Dis = {} ;
var ObjectId = require('mongodb').ObjectId;
  this.add('role:viewers,cmd:getServers', (msg, respond) => {
    let validation = new Promise((resolve, reject) => {

      resolve()
    });

    let multi=clientRedis.multi();

    let promIDs = validation.then(() => clientRedis.scanAsync('0','MATCH','viewer:*','count','100000'))// 100000 should always be bigger if there are more viewers
    .then((viewers) => {
      let allViewersID = [];
      let slices = [];
      for (let v of viewers[1]) {
        slices = v.split(":");
        if(slices[2] === "servers") {
          var Oid = new ObjectId(slices[1]);
          allViewersID.push(Oid);
        }
      };
      return allViewersID;
    });

    let promUsernames = promIDs.then((allViewersID) => {return dbMongo.collection('users').find({"_id": { $in: allViewersID } }).toArrayAsync().map( (res) => {
        //console.log(res.username);
        return {"_id":res._id, "username":res.username};
      });
    });

    let promListServers = promIDs.then( (allViewersID) => {
      allViewersID.forEach( function(id) {
        multi.lrange(`viewer:${id}:servers`, '0', '-1');
      });
    })
    .then(() => multi.execAsync());

    let promBitrate = validation.then(() => clientRedis.hgetall("distrib", (err, res) => {
      Dis =res;
    }));

    Promise.join(promUsernames, promListServers, promBitrate, (usernames, servers, bitrate) => {
     // console.log(Dis);

      let serversByUsernames = [];
      usernames.forEach((username, i) => {
        serversByUsernames.push({"id":username._id.toString(), "username":username.username, "servers":servers[i]})
      })
      //console.log(serversByUsernames);
      respond(null, { 'code': 200 , 'status': "list of server." , 'data': {'listserversByViewers': serversByUsernames, "distrib":Dis}});
    });
  });


};
