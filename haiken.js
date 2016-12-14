'use strict';

exports.handler = (event, context, callback) => {
    let AWS = require('aws-sdk');
    AWS.config.update({region: 'ap-northeast-1'});
    let s3 = new AWS.S3();
    s3.getObject({Bucket: 'haiken', Key: 'list.csv'}, function(err, listCsv){
      let csv = listCsv.Body.toString();
        csv.split(',').forEach(function(url){
          let https = require('https');
            https.get(url, function(res){
             if(res.statusCode != 200){
               let sns = new AWS.SNS();
               sns.publish({
                 Message: url + ' is error',
                 Subject: 'error notification',
                 TopicArn: 'arn:aws:sns:ap-northeast-1:740661453123:haiken'
               }, (err, data) => {
                   console.log(err);
               });
    
             }
            }).on('error', (err) => {console.log(err)});
    
        });
    })
}
