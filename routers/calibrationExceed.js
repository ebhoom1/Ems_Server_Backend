const express =require('express')

const {addComment,getAllExceedData,editComments, getAUserExceedData,getExceedDataByUserName,handleExceedValues,fetchAndDeleteDataByUserName} =require('../controllers/calibrationExceed')

const router =express.Router()

// Define the route for handleExceedValues
router.post('/handleExceedValues', handleExceedValues);

router.post('/add-comments/:id',addComment);

router.get('/get-all-exceed-data',getAllExceedData);

router.put('/edit-comments/:id',editComments); 

router.get('/get-user-exceed-data/:userName',getExceedDataByUserName); 

router.get('/user-exceed-data',getAUserExceedData)  

// Route to delete user exceed data by userName
router.delete('/user-exceed-data/:userName', async (req, res) => {
    const { userName } = req.params;

    try {
        // Call the function to fetch and delete data
        const response = await fetchAndDeleteDataByUserName(userName);

        if (!response.success) {
            return res.status(404).json({
                success: false,
                message: response.message,
            });
        }

        res.status(200).json({
            success: true,
            message: response.message,
            deletedData: response.deletedData, // Include deleted data for confirmation if necessary
        });
    } catch (error) {
        console.error('Error in deleting user exceed data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete user exceed data',
            error: error.message,
        });
    }
});
module.exports =router; 