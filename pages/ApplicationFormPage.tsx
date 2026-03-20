import React, { useState, useEffect, useRef } from 'react';
// FIX: Changed to namespace import for react-router-dom
import * as ReactRouterDOM from 'react-router-dom';
import type { Offer } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { handleImageError } from '../components/utils/imageUtils';
import { 
    ArrowLeftIcon, 
    ProfileIcon, 
    EnvelopeIcon, 
    PhoneIcon, 
    LinkIcon, 
    DocumentTextIcon, 
    CurrencyDollarIcon, 
    CheckCircleIcon,
    ArrowUpTrayIcon,
    CubeIcon,
    BuildingOffice2Icon,
    CalendarDaysIcon,
    UsersIcon,
    GlobeAltIcon,
    AcademicCapIcon,
    WrenchScrewdriverIcon,
    BriefcaseIcon,
    CloseIcon,
    // FIX: Imported the missing CheckIcon component.
    CheckIcon,
} from '../components/ui/Icons';

const ApplicationFormPage = () => {
    const location = ReactRouterDOM.useLocation();
    const navigate = ReactRouterDOM.useNavigate();
    const { currentUser } = useAuth();
    const offer: Offer | undefined = location.state?.offer;

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        fullName: currentUser?.displayName || '',
        email: currentUser?.email || '',
        phone: '',
        address: '',
        dob: '',
        gender: '',
        nationality: '',
        portfolio: '',
        resume: null as File | null,
        skills: '',
        workExperience: '',
        education: '',
        coverLetter: '',
        proudProject: '',
        salary: '',
    });
    // FIX: Changed the type of the 'errors' state to correctly store string-based error messages for each form field, rather than trying to store them as the same type as the form data itself.
    const [errors, setErrors] = useState<{ [K in keyof typeof formData]?: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounter = useRef(0);

    useEffect(() => {
        // If there's no offer data (e.g., page refresh), navigate back to spotlight
        if (!offer) {
            navigate('/spotlight');
        }
    }, [offer, navigate]);

    if (!offer) {
        // Render nothing while redirecting
        return null;
    }

    const steps = ['Personal Details', 'Professional Details', 'Screening', 'Review'];

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, resume: e.target.files[0] }));
            if (errors.resume) {
                setErrors(prev => ({ ...prev, resume: undefined }));
            }
        }
    };

    const handleRemoveFile = () => {
        setFormData(prev => ({ ...prev, resume: null }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatFileSize = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDraggingOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDraggingOver(false);
        }
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        dragCounter.current = 0;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            setFormData(prev => ({ ...prev, resume: e.dataTransfer.files[0] }));
            if (errors.resume) {
                setErrors(prev => ({ ...prev, resume: undefined }));
            }
            // Assign the dropped files to the file input
            if (fileInputRef.current) {
                fileInputRef.current.files = e.dataTransfer.files;
            }
            e.dataTransfer.clearData();
        }
    };
    
    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };


    const validateStep = () => {
        // FIX: Updated the type of 'newErrors' to match the corrected 'errors' state type.
        const newErrors: { [K in keyof typeof formData]?: string } = {};
        if (currentStep === 1) {
            if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required.';
            if (!formData.email.trim()) {
                newErrors.email = 'Email is required.';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                newErrors.email = 'Please enter a valid email format.';
            }
            if (!formData.dob) newErrors.dob = 'Date of Birth is required.';
            if (!formData.gender) newErrors.gender = 'Please select a gender.';
            if (!formData.nationality.trim()) newErrors.nationality = 'Nationality is required.';
        }
        if (currentStep === 2) {
            if (formData.portfolio && !/^(ftp|http|https):\/\/[^ "]+$/.test(formData.portfolio)) {
                newErrors.portfolio = 'Please enter a valid URL.';
            }
            if (!formData.resume) newErrors.resume = 'A resume is required.';
            if (!formData.skills.trim()) newErrors.skills = 'Please list some of your skills.';
            if (!formData.workExperience.trim()) newErrors.workExperience = 'Work experience is required.';
        }
        if (currentStep === 3) {
            if (!formData.proudProject.trim()) newErrors.proudProject = 'This field is required.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    const nextStep = () => {
        if (validateStep()) {
            setCurrentStep(prev => Math.min(prev + 1, steps.length));
        }
    };

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentStep !== steps.length) return;

        setIsSubmitting(true);
        // Simulate API call
        await new Promise(res => setTimeout(res, 2000));
        setIsSubmitting(false);
        setIsSubmitted(true);
    };

    const renderStepContent = () => {
        const inputWrapperClass = "relative mb-6";
        const iconClass = "absolute left-4 top-[13px] w-5 h-5 text-gray-400 pointer-events-none";
        const inputClass = "w-full bg-invox-dark border border-gray-700 rounded-lg p-3 pl-12 focus:outline-none focus:ring-2 focus:ring-invox-red text-white transition-colors";

        switch (currentStep) {
            case 1: // Personal Details
                return (
                    <div>
                        <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6">
                            <div className={inputWrapperClass}>
                                <ProfileIcon className={iconClass} />
                                <input type="text" name="fullName" placeholder="Full Name" value={formData.fullName} onChange={handleInputChange} className={inputClass} />
                                {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
                            </div>
                            <div className={inputWrapperClass}>
                                <EnvelopeIcon className={iconClass} />
                                <input type="email" name="email" placeholder="Email Address" value={formData.email} onChange={handleInputChange} className={inputClass} />
                                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                            </div>
                            <div className={inputWrapperClass}>
                                <PhoneIcon className={iconClass} />
                                <input type="tel" name="phone" placeholder="Phone Number (Optional)" value={formData.phone} onChange={handleInputChange} className={inputClass} />
                            </div>
                            <div className={inputWrapperClass}>
                                <GlobeAltIcon className={iconClass} />
                                <input type="text" name="nationality" placeholder="Nationality" value={formData.nationality} onChange={handleInputChange} className={inputClass} />
                                {errors.nationality && <p className="text-red-500 text-xs mt-1">{errors.nationality}</p>}
                            </div>
                             <div className={inputWrapperClass}>
                                <CalendarDaysIcon className={iconClass} />
                                <input
                                    type="text"
                                    name="dob"
                                    placeholder="Date of Birth"
                                    onFocus={(e) => (e.target.type = 'date')}
                                    onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
                                    value={formData.dob}
                                    onChange={handleInputChange}
                                    className={inputClass}
                                />
                                {errors.dob && <p className="text-red-500 text-xs mt-1">{errors.dob}</p>}
                            </div>
                            <div className={inputWrapperClass}>
                                <UsersIcon className={iconClass} />
                                <select name="gender" value={formData.gender} onChange={handleInputChange} className={`${inputClass} ${!formData.gender ? 'text-gray-400' : 'text-white'}`}>
                                    <option value="" disabled>Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Non-binary">Non-binary</option>
                                    <option value="Prefer not to say">Prefer not to say</option>
                                </select>
                                {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
                            </div>
                            <div className={`${inputWrapperClass} md:col-span-2`}>
                                <BuildingOffice2Icon className={iconClass} />
                                <input type="text" name="address" placeholder="Current Address (Optional)" value={formData.address} onChange={handleInputChange} className={inputClass} />
                            </div>
                        </div>
                    </div>
                );
            case 2: // Professional Details
                 return (
                    <div>
                        <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6">
                            <div className={`${inputWrapperClass} md:col-span-2`}>
                                <LinkIcon className={iconClass} />
                                <input type="url" name="portfolio" placeholder="Portfolio/Website Link (Optional)" value={formData.portfolio} onChange={handleInputChange} className={inputClass} />
                                {errors.portfolio && <p className="text-red-500 text-xs mt-1">{errors.portfolio}</p>}
                            </div>
                            <div className={`${inputWrapperClass} md:col-span-2`}>
                                <label className="block text-invox-light-gray mb-2 text-sm font-semibold">Resume/CV</label>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') triggerFileSelect(); }}
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    onClick={triggerFileSelect}
                                    className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDraggingOver ? 'border-invox-red bg-invox-red/10' : 'border-gray-600 hover:border-gray-500'}`}
                                >
                                    <input ref={fileInputRef} type="file" name="resume" onChange={handleFileChange} className="hidden" accept=".pdf,.doc,.docx" />
                                    <ArrowUpTrayIcon className="w-8 h-8 text-gray-400 mb-2" />
                                    <p className="text-gray-400 text-sm">
                                        <span className="font-semibold text-invox-red">Click to upload</span> or drag and drop
                                    </p>
                                    <p className="text-xs text-gray-500">PDF, DOC, DOCX (MAX. 5MB)</p>
                                </div>
                                {errors.resume && <p className="text-red-500 text-xs mt-1">{errors.resume}</p>}
                                {formData.resume && (
                                    <div className="mt-3 bg-invox-dark p-3 rounded-lg flex items-center justify-between border border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <DocumentTextIcon className="w-6 h-6 text-invox-red" />
                                            <div>
                                                <p className="text-sm font-semibold text-white truncate max-w-xs">{formData.resume.name}</p>
                                                <p className="text-xs text-gray-400">{formatFileSize(formData.resume.size)}</p>
                                            </div>
                                        </div>
                                        <button onClick={handleRemoveFile} className="text-gray-400 hover:text-white transition-transform duration-200 transform hover:scale-110 active:scale-100" aria-label="Remove resume file">
                                            <CloseIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className={`${inputWrapperClass} md:col-span-2`}>
                                <WrenchScrewdriverIcon className={iconClass} />
                                <textarea name="skills" placeholder="List your relevant skills (comma-separated)" value={formData.skills} onChange={handleInputChange} className={`${inputClass} h-24 resize-none`} />
                                {errors.skills && <p className="text-red-500 text-xs mt-1">{errors.skills}</p>}
                            </div>
                            <div className={`${inputWrapperClass} md:col-span-2`}>
                                <BriefcaseIcon className={iconClass} />
                                <textarea name="workExperience" placeholder="Summarize your work experience" value={formData.workExperience} onChange={handleInputChange} className={`${inputClass} h-32 resize-none`} />
                                {errors.workExperience && <p className="text-red-500 text-xs mt-1">{errors.workExperience}</p>}
                            </div>
                            <div className={`${inputWrapperClass} md:col-span-2`}>
                                <AcademicCapIcon className={iconClass} />
                                <textarea name="education" placeholder="Describe your education" value={formData.education} onChange={handleInputChange} className={`${inputClass} h-24 resize-none`} />
                            </div>
                        </div>
                    </div>
                );
            case 3: // Screening
                 return (
                    <div>
                        <div className="pt-2 space-y-6">
                            <div className={inputWrapperClass}>
                                <CubeIcon className={iconClass} />
                                <textarea name="proudProject" placeholder="Tell us about a project you're proud of." value={formData.proudProject} onChange={handleInputChange} className={`${inputClass} h-40 resize-none`} />
                                {errors.proudProject && <p className="text-red-500 text-xs mt-1">{errors.proudProject}</p>}
                            </div>
                            <div className={inputWrapperClass}>
                                <CurrencyDollarIcon className={iconClass} />
                                <input type="number" name="salary" placeholder="Expected Salary (Annual, USD, Optional)" value={formData.salary} onChange={handleInputChange} className={inputClass} min="0" />
                            </div>
                            <div className={inputWrapperClass}>
                                <EnvelopeIcon className={iconClass} />
                                <textarea name="coverLetter" placeholder="Cover Letter (Optional)" value={formData.coverLetter} onChange={handleInputChange} className={`${inputClass} h-48 resize-none`} />
                            </div>
                        </div>
                    </div>
                );
            case 4: // Review
                const renderDetail = (label: string, value: string | null | undefined) => (
                    value ? <div className="py-2"><p className="text-sm text-gray-400">{label}</p><p className="text-white break-words">{value}</p></div> : null
                );

                return (
                    <div className="pt-2">
                        <h3 className="text-lg font-bold text-white border-b border-gray-700 pb-2 mb-3">Personal Details</h3>
                        {renderDetail("Full Name", formData.fullName)}
                        {renderDetail("Email", formData.email)}
                        {renderDetail("Phone", formData.phone)}
                        {renderDetail("Date of Birth", formData.dob)}
                        {renderDetail("Gender", formData.gender)}
                        {renderDetail("Nationality", formData.nationality)}
                        {renderDetail("Address", formData.address)}

                        <h3 className="text-lg font-bold text-white border-b border-gray-700 pb-2 mb-3 mt-6">Professional Details</h3>
                        {renderDetail("Portfolio", formData.portfolio)}
                        {formData.resume && renderDetail("Resume/CV", `${formData.resume.name} (${formatFileSize(formData.resume.size)})`)}
                        {renderDetail("Skills", formData.skills)}
                        {renderDetail("Work Experience", formData.workExperience)}
                        {renderDetail("Education", formData.education)}
                        
                        <h3 className="text-lg font-bold text-white border-b border-gray-700 pb-2 mb-3 mt-6">Screening Questions</h3>
                        {renderDetail("Project You're Proud Of", formData.proudProject)}
                        {renderDetail("Expected Salary (USD)", formData.salary)}
                        {renderDetail("Cover Letter", formData.coverLetter)}
                    </div>
                );
            default:
                return null;
        }
    };
    
    if (isSubmitted) {
        return (
             <div className="min-h-screen bg-invox-dark text-white flex items-center justify-center p-4">
                <div className="bg-invox-dark-accent p-8 rounded-xl shadow-2xl w-full max-w-lg text-center border border-gray-700">
                    <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-white mb-3">Application Submitted!</h1>
                    <p className="text-gray-300 mb-6">
                        Thank you for applying for the <strong>{offer.title}</strong> role at <strong>{offer.companyName}</strong>.
                        We have received your application and will be in touch soon.
                    </p>
                    <button onClick={() => navigate('/spotlight?tab=Leap&subTab=GoForIt')} className="bg-invox-red px-8 py-3 rounded-lg font-semibold hover:bg-invox-red-hover transition-all duration-200 transform hover:scale-105 active:scale-95">
                        Back to Opportunities
                    </button>
                </div>
            </div>
        );
    }
    

    return (
        <div className="min-h-screen bg-invox-dark text-white p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-4 text-invox-light-gray hover:text-white transition-all duration-200 transform hover:scale-105 active:scale-95">
                    <ArrowLeftIcon className="w-5 h-5" />
                    <span>Back</span>
                </button>
                <div className="bg-invox-dark-accent rounded-xl shadow-2xl border border-gray-700">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-700">
                        <div className="flex items-center gap-4">
                            <img src={offer.companyAvatarUrl} onError={handleImageError} alt={offer.companyName} className="w-14 h-14 rounded-lg object-cover" />
                            <div>
                                <h1 className="text-2xl font-bold text-white">Apply for {offer.title}</h1>
                                <p className="text-gray-400">at {offer.companyName}</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Stepper */}
                    <div className="p-6 border-b border-gray-700">
                        <div className="flex justify-between items-center">
                            {steps.map((step, index) => (
                                <React.Fragment key={step}>
                                    <div className="flex flex-col items-center text-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${index + 1 <= currentStep ? 'bg-invox-red border-invox-red' : 'bg-gray-700 border-gray-600'}`}>
                                            {index + 1 < currentStep ? <CheckIcon className="w-5 h-5 text-white" /> : <span className="font-bold text-white">{index + 1}</span>}
                                        </div>
                                        <p aria-current={index + 1 === currentStep ? "step" : undefined} className={`mt-2 text-xs font-semibold ${index + 1 <= currentStep ? 'text-white' : 'text-gray-500'}`}>{step}</p>
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div className={`flex-1 h-1 mx-4 transition-colors ${index + 1 < currentStep ? 'bg-invox-red' : 'bg-gray-600'}`}></div>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    
                    {/* Form Body */}
                    <div className="p-6">
                        {renderStepContent()}
                    </div>
                    
                    {/* Footer - Navigation */}
                    <div className="flex justify-between items-center p-4 bg-invox-dark rounded-b-xl border-t border-gray-700">
                        <button onClick={prevStep} disabled={currentStep === 1 || isSubmitting} className="bg-invox-dark border border-gray-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-800 transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                            Previous
                        </button>
                        {currentStep < steps.length ? (
                            <button onClick={nextStep} className="bg-invox-red px-8 py-2 rounded-lg font-semibold hover:bg-invox-red-hover transition-all duration-200 transform hover:scale-105 active:scale-95">
                                Next
                            </button>
                        ) : (
                            <button onClick={handleSubmit} disabled={isSubmitting} className="bg-green-600 px-8 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:bg-green-800 disabled:cursor-wait">
                                {isSubmitting ? 'Submitting...' : 'Submit Application'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default ApplicationFormPage;