/*jslint node: true */
/*jshint esversion: 6 */
'use strict';

//Dependencies

let Promise = require('bluebird');  //jshint ignore:line

let moment = require('moment');

//API

module.exports = function (options) {

    //Database client attached
    let client = options.client;

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

        validation.then(client.hmsetAsync(`viewer:${msg.id_viewer}`, {
            "id_uploader": msg.id_uploader,
            "date_started": moment().format() }))  //date format moment.js ISO : '2016-08-02T15:44:09-05:00'
        .then(() => {return client.lpushAsync(`viewer:${msg.id_viewer}:servers`, ['TODO myserver1', 'myserver2']); } )   //add default list of servers for this session
        .then(() => {return new Promise( () => respond(null, { 'code': 200 , 'status': "Viewer added succesfully." }), null );} )
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

        validation.then(client.hmsetAsync(`uploader:${msg.id_uploader}`, {
            "title": msg.title }))  //date format moment.js ISO : '2016-08-02T15:44:09-05:00'
        .then(() => {return client.lpushAsync(`uploader:${msg.id_uploader}:tags`, msg.tags); } )   //add tags, array form
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

};
