const express = require('express');

const router = express.Router();

router.post('/api/reboot/:deviceTopic',(req,res)=>{
    const { deviceTopic } = req.params;
    if(deviceTopic){
        sendRebootCommand(deviceTopic);
        res.status(200).send('Reboot commant sent');
    }else{
        res.status(400).send('Device topic is required')
    }
});

module.exports = router;