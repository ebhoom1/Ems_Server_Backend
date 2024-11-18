const express = require('express');
const axios = require('axios');
const router= express.Router();;

router.get('/get-video-url',async(req,res)=>{
    try{
        const response = await axios.post('https://cctv-cloud-provider.com/api/auth',{
            username:"userName",
            password:'password'
        });
        const token = response.data.token;

        const videoResponse = await axios.get('https://cctv-cloud-provider.com/api/video-stream',{
            headers: {
                Authorization: `Bearer ${token}`
              }
        })
        const videoUrl = videoResponse.data.videoUrl;
        res.json({videoUrl})
    }catch(error){
        console.error(error);
    res.status(500).send('Failed to get video URL');
    }
})

const cameras = [
    { id: '1', name: 'Camera 1' },
    { id: '2', name: 'Camera 2' },
    { id: '3', name: 'Camera 3' },
    { id: '4', name: 'Camera 4' },
    { id: '5', name: 'Camera 5' }
  ];

  router.get('/get-video-url-of-all-camera', async (req, res) => {
    const cameraId = req.query.id;
  
    if (!cameraId || !cameras.find(camera => camera.id === cameraId)) {
      return res.status(400).send('Invalid camera ID');
    }
  
    try {
      const response = await axios.post('https://cctv-cloud-provider.com/api/auth', {
        username: 'userName',
        password: 'password'
      });
      const token = response.data.token;
  
      const videoResponse = await axios.get(`https://cctv-cloud-provider.com/api/video-stream/${cameraId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
  
      const videoUrl = videoResponse.data.videoUrl;
      res.json({ videoUrl });
    } catch (error) {
      console.error(error);
      res.status(500).send('Failed to get video URL');
    }
  });
  

module.exports =router