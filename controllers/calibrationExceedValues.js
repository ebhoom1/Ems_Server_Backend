const CalibrationExceedValues = require('../models/calibrationExceedValues');

//Add Calibration Exceed Values
const AddCalibrationExceedValues = async (req, res) => {
    try {
        const { product_id, phBelow,phAbove, TDS, turbidity, temperature, BOD, COD,
            TSS, ORP, nitrate, ammonicalNitrogen, DO, chloride,Flow,CO,NOX,Pressure,PM,Flouride,SO2,NO2,Mercury, PM10, PM25, NOH, NH3, WindSpeed,
            WindDir, AirTemperature, Humidity, solarRadiation, DB, date, adminUserName,userName,adminName,industryType } = req.body;

            const preIndustry = await CalibrationExceedValues.findOne({industryType:industryType,});
            if(preIndustry){
                return res.status(422).json({error:'This Industry already used'})
            }
            // Check if an entry with the same userName and product_id already exists
            const preUserProduct = await CalibrationExceedValues.findOne({ userName: userName });
            if (preUserProduct) {
            return res.status(422).json({ error: 'This user ID combination already exists' });
            }
            
                const newCalibrationExceedValues = new CalibrationExceedValues({
                    product_id, phBelow,phAbove, TDS, turbidity, temperature, BOD, COD,
                    TSS, ORP, nitrate, ammonicalNitrogen, DO, chloride,Flow,CO,NOX,Pressure,PM,Flouride,SO2,NO2,Mercury, PM10, PM25, NOH, NH3, WindSpeed,
                    WindDir, AirTemperature, Humidity, solarRadiation, DB, date, adminUserName, userName, adminName,industryType
                });
        
                await newCalibrationExceedValues.save();
        
                res.status(201).json({
                    success: true,
                    message: 'The Calibration Exceed Values are saved successfully',
                    calibrationExceedValues: newCalibrationExceedValues
                });
            

        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error from Catch",
            error: error.message
        });
    }
};

//Get All calibration Exceed Values 
  const getAllCalibrationExceedValues=async (req,res)=>{
    try {
        const allCalibrationExceedValues=await CalibrationExceedValues.find()

        res.status(200).json({
            success:true,
            message:'All Calibration Exceed Values finded successfully',
            calibrationExceedValues:allCalibrationExceedValues
        })
    } catch (error) {
        res.status(500).json({
            success:false,
            message:'Failed to fetch the Calibration Exceed Values',
            error:error.message
        })
    }
  }

// Get calibration Exceed Values by UserName
const getCalibrationExceedValues = async (req, res) => {
    try {
        const { userName } = req.params;

        const userCalibrationExceedValues = await CalibrationExceedValues.find({ userName });

        res.status(200).json({
            status: 200,
            success: true,
            message: `Calibration Exceed Values of ${userName} fetched Successfully`,
            userCalibrationExceedValues,
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            success: false,
            message: `Error in fetching the calibration Exceed values`,
            error: error.message,
        });
    }
};

// Get calibration Exceed Value by Industry Type
const getCalibrationExceedValuesByIndustryType = async (req,res)=>{
    try {
        const {industryType} =req.params;

        //Check if industryType is Provided
        if(!industryType){
            return res.status(400).json({
                status:400,
                success:false,
                message:'industry type paramater is required'
            })
        }
        const IndustryCalibrationExceedValues = await CalibrationExceedValues.find({industryType})
        // Handle case when no records are found
        if (!IndustryCalibrationExceedValues.length) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: `No calibration exceed values found for industry type: ${industryType}`
            });
        }
        res.status(200).json({
            status: 200,
            success: true,
            message: `Calibration Exceed Values of ${industryType} fetched successfully`,
            IndustryTypCalibrationExceedValues: IndustryCalibrationExceedValues,
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            success: false,
            message: 'Error in fetching the calibration exceed values',
            error: error.message,
        });
    }
}


//Edit Calibration Exceed Values
const editCalibrationExceedValues = async( req,res)=>{
    try {
        const {userName} =req.params;
        const updateFields = req.body;
    
        //Find the calibration Exceed value by userName and update It
        const updateCalibrationExceedValue = await CalibrationExceedValues.findOneAndUpdate({userName:userName},updateFields,{new:true})
    
        if(!updateCalibrationExceedValue){
            return res.status(404).json({
                success:false,
                message:'Calibration Exceed Value is not found'
            })
        }
        res.status(200).json({
            success:true,
            message:`Calibration Exceed Value Upadate successfully`,
            calibrationExceedValue : updateCalibrationExceedValue
        })
    } catch (error) {
        res.status(500).json({
            success:false,
            message:'Failed to update to Calibration Exceed Values',
            error:error.message
        })
    }
  
}

// Delete Calibration Exceed Values
const deleteCalibrationExceedValues = async (req,res)=>{
    try {
        const { _id } = req.params;

         // Find the Calibration Exceed Value by Id and delete it
         const deletedCalibrationExceedValue = await CalibrationExceedValues.findByIdAndDelete(_id);

        if(!deletedCalibrationExceedValue){
            return res.status(404).json({
                success:false,
                message:'Calibration Exceed Value not found'
            })
        }
        res.status(200).json({
            success:true,
            message:'Calibration Exceed Value Deleted Successfully',
            calibrationExceedValue:deletedCalibrationExceedValue
        })
    } catch (error) {
        res.status(500).json({
            success:false,
            message:'Failed to delete Calibration Exceed Value',
            error:error.message
        })
        
    }
}
module.exports = { getCalibrationExceedValues, AddCalibrationExceedValues,editCalibrationExceedValues,deleteCalibrationExceedValues,getAllCalibrationExceedValues,getCalibrationExceedValuesByIndustryType };
