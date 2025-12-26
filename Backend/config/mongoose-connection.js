import mongoose from "mongoose";
import config from 'config';
import debug from 'debug';

const mongooseDebug = debug('development:mongoose');

const dbURI = config.get("MONGODB_URI") || "mongodb://127.0.0.1:27017";

mongoose
  .connect(`${dbURI}/Resilient_Uploader`)
  .then(function(){
    mongooseDebug('connected to DB');
  })
  .catch(function(err){
    mongooseDebug(err);
  });

export default mongoose.connection;