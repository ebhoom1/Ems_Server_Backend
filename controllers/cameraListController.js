// controllers/cameraListController.js

const getCameraList = (req, res) => {
  const cameras = [
    {
      id: "cam1",
      name: "Camera 1",
      hlsUrl: "http://100.93.124.98:8888/cam1/index.m3u8",
      status: "offline"
    },
    {
      id: "cam2",
      name: "Camera 2",
      hlsUrl: "http://100.93.124.98:8888/cam2/index.m3u8",
      status: "offline"
    },
    {
      id: "cam3",
      name: "Camera 3",
      hlsUrl: "http://100.93.124.98:8888/cam3/index.m3u8",
      status: "offline"
    },
    {
      id: "cam4",
      name: "Camera 4",
      hlsUrl: "http://100.93.124.98:8888/cam4/index.m3u8",
      status: "offline"
    }
  ];

  res.json({
    success: true,
    count: cameras.length,
    data: cameras
  });
};

module.exports = {
  getCameraList
};
