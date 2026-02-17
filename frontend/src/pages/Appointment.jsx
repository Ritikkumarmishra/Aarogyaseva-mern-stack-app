import React, { useContext, useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import RelatedDoctors from '../components/RelatedDoctors'
import axios from 'axios'
import { toast } from 'react-toastify'

const Appointment = () => {

    const { docId } = useParams()
    const { doctors, currencySymbol, backendUrl, token, getDoctosData } = useContext(AppContext)
    const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

    const [docInfo, setDocInfo] = useState(false)
    const [docSlots, setDocSlots] = useState([])
    const [slotIndex, setSlotIndex] = useState(0)
    const [slotTime, setSlotTime] = useState('')
    const [loading, setLoading] = useState(false) // FIX 6: prevent double booking

    const navigate = useNavigate()

    const fetchDocInfo = async () => {
        const docInfo = doctors.find((doc) => doc._id === docId)
        setDocInfo(docInfo)
    }

    // FIX 2: Wrapped in useCallback so useEffect dependency is stable
    const getAvailableSlots = useCallback(() => {

        let today = new Date()
        let allSlots = []

        for (let i = 0; i < 7; i++) {

            let currentDate = new Date(today)
            currentDate.setDate(today.getDate() + i)

            let endTime = new Date(currentDate)
            endTime.setHours(21, 0, 0, 0)

            if (i === 0) {
                const currentHour = currentDate.getHours()
                const currentMinutes = currentDate.getMinutes()

                // FIX 3: Correct minute snapping logic
                // If past 10am, start from next hour or snap to :30
                if (currentHour >= 10) {
                    if (currentMinutes < 30) {
                        currentDate.setHours(currentHour, 30, 0, 0)
                    } else {
                        currentDate.setHours(currentHour + 1, 0, 0, 0)
                    }
                } else {
                    currentDate.setHours(10, 0, 0, 0)
                }
            } else {
                currentDate.setHours(10, 0, 0, 0)
            }

            let timeSlots = []

            while (currentDate < endTime) {

                let formattedTime = currentDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                })

                let day = currentDate.getDate()
                let month = currentDate.getMonth() + 1
                let year = currentDate.getFullYear()

                const slotDate = `${day}_${month}_${year}`

                const isSlotAvailable =
                    !docInfo.slots_booked?.[slotDate]?.includes(formattedTime)

                if (isSlotAvailable) {
                    timeSlots.push({
                        datetime: new Date(currentDate),
                        time: formattedTime
                    })
                }

                currentDate.setMinutes(currentDate.getMinutes() + 30)
            }

            allSlots.push(timeSlots)
        }

        setDocSlots(allSlots)

    }, [docInfo])

    const bookAppointment = async () => {

        if (!token) {
            toast.warning('Login to book appointment')
            return navigate('/login')
        }

        // FIX 5: Single, clear validation block (removed duplicate check)
        if (!slotTime || !docSlots[slotIndex]?.length) {
            toast.warning('Please select a valid time slot')
            return
        }

        const date = docSlots[slotIndex][0].datetime

        let day = date.getDate()
        let month = date.getMonth() + 1
        let year = date.getFullYear()

        const slotDate = `${day}_${month}_${year}`

        try {
            setLoading(true) // FIX 6: disable button while booking
            const { data } = await axios.post(
                backendUrl + '/api/user/book-appointment',
                { docId, slotDate, slotTime },
                { headers: { token } }
            )

            if (data.success) {
                toast.success(data.message)
                getDoctosData()
                navigate('/my-appointments')
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            console.log(error)
            toast.error(error.message)
        } finally {
            setLoading(false) // FIX 6: always re-enable button
        }
    }

    // FIX 4: Reset slotTime whenever the user switches to a different day
    const handleSlotIndexChange = (index) => {
        setSlotIndex(index)
        setSlotTime('')
    }

    useEffect(() => {
        if (doctors.length > 0) {
            fetchDocInfo()
        }
    }, [doctors, docId])

    useEffect(() => {
        if (docInfo) {
            getAvailableSlots()
        }
    }, [docInfo, getAvailableSlots]) // FIX 2: getAvailableSlots added as stable dependency

    return docInfo ? (
        <div>

            {/* ---------- Doctor Details ----------- */}
            <div className='flex flex-col sm:flex-row gap-4'>
                <div>
                    <img className='bg-primary w-full sm:max-w-72 rounded-lg' src={docInfo.image} alt="" />
                </div>

                <div className='flex-1 border border-[#ADADAD] rounded-lg p-8 py-7 bg-white mx-2 sm:mx-0 mt-[-80px] sm:mt-0'>

                    <p className='flex items-center gap-2 text-3xl font-medium text-gray-700'>
                        {docInfo.name}
                        <img className='w-5' src={assets.verified_icon} alt="" />
                    </p>
                    <div className='flex items-center gap-2 mt-1 text-gray-600'>
                        <p>{docInfo.degree} - {docInfo.speciality}</p>
                        <button className='py-0.5 px-2 border text-xs rounded-full'>{docInfo.experience}</button>
                    </div>

                    <div>
                        <p className='flex items-center gap-1 text-sm font-medium text-[#262626] mt-3'>
                            About <img className='w-3' src={assets.info_icon} alt="" />
                        </p>
                        <p className='text-sm text-gray-600 max-w-[700px] mt-1'>{docInfo.about}</p>
                    </div>

                    <p className='text-gray-600 font-medium mt-4'>
                        Appointment fee: <span className='text-gray-800'>{currencySymbol}{docInfo.fees}</span>
                    </p>
                </div>
            </div>

            {/* Booking slots */}
            <div className='sm:ml-72 sm:pl-4 mt-8 font-medium text-[#565656]'>
                <p>Booking slots</p>

                <div className='flex gap-3 items-center w-full overflow-x-scroll mt-4'>
                    {/* FIX 1: Use index as key since item is an array, not an object with datetime */}
                    {docSlots.length > 0 && docSlots.map((item, index) => (
                        <div
                            onClick={() => handleSlotIndexChange(index)} // FIX 4: clears slotTime on day change
                            key={index}  // FIX 1: was item.datetime (undefined) — now uses index
                            className={`text-center py-6 min-w-16 rounded-full cursor-pointer ${slotIndex === index ? 'bg-primary text-white' : 'border border-[#DDDDDD]'}`}
                        >
                            <p>{item[0] && daysOfWeek[item[0].datetime.getDay()]}</p>
                            <p>{item[0] && item[0].datetime.getDate()}</p>
                            {item.length === 0 && <p className="text-xs text-red-400 mt-1">No Slots</p>}
                        </div>
                    ))}
                </div>

                <div className='flex items-center gap-3 w-full overflow-x-scroll mt-4'>
                    {docSlots.length > 0 && docSlots[slotIndex].map((item) => (
                        <p
                            onClick={() => setSlotTime(item.time)}
                            key={item.datetime.getTime()} // ✅ this key is fine — item here IS a slot object
                            className={`text-sm font-light flex-shrink-0 px-5 py-2 rounded-full cursor-pointer ${item.time === slotTime ? 'bg-primary text-white' : 'text-[#949494] border border-[#B4B4B4]'}`}
                        >
                            {item.time.toLowerCase()}
                        </p>
                    ))}
                </div>

                {/* FIX 6: Disabled and shows feedback while booking is in progress */}
                <button
                    onClick={bookAppointment}
                    disabled={loading}
                    className={`text-white text-sm font-light px-20 py-3 rounded-full my-6 transition-opacity ${loading ? 'bg-gray-400 cursor-not-allowed opacity-70' : 'bg-primary'}`}
                >
                    {loading ? 'Booking...' : 'Book an appointment'}
                </button>
            </div>

            {/* Listing Related Doctors */}
            <RelatedDoctors speciality={docInfo.speciality} docId={docId} />
        </div>
    ) : null
}

export default Appointment