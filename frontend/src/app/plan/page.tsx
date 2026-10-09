"use client";

import { useState } from 'react';
import Link from 'next/link';
import ResultsDashboard, { type ResultsDashboardData } from '@/components/ResultsDashboard';
import TattooSizePicker from '@/components/TattooSizePicker';
import { INDIAN_CITIES, INDIAN_CITY_ALIASES, resolveIndianCity } from '@/lib/indian-cities';
import {
  PROPORTIONS,
  formatInches,
  recommendedDimensions,
  validateDimensions,
  type Complexity,
  type TattooDimensions,
} from '@/lib/tattoo-dimensions';

export default function PlanPage() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    health: { conditions: false, skinConditions: false, allergies: false, diabetes: false, immune: false, healing: false, meds: false },
    skinTone: '',
    designType: 'text',
    designText: '',
    inkColor: '',
    inkBrand: 'No Preference',
    bodyPart: '',
    country: 'India',
    city: '',
    countryCode: 'IN',
  });

  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [resultsData, setResultsData] = useState<ResultsDashboardData | null>(null);
  const [dimensions, setDimensions] = useState<TattooDimensions>(() => recommendedDimensions(PROPORTIONS[0], 'Medium'));
  const cityOptions = [...INDIAN_CITIES, ...Object.keys(INDIAN_CITY_ALIASES)];
  // Long written briefs usually mean detailed artwork.
  const complexity: Complexity = formData.designType === 'text' && formData.designText.length > 50 ? 'Complex' : 'Medium';
  const sizeLabel = `${formatInches(dimensions.width)} x ${formatInches(dimensions.height)} in`;

  const fetchResults = async () => {
    setIsLoading(true);
    try {
      const modelCountry = 'IN';
      const enteredCity = formData.city.trim();
      const modelCity = resolveIndianCity(enteredCity) ?? enteredCity;
      if (!modelCity) {
        window.alert('Enter or select an Indian city before continuing.');
        setIsLoading(false);
        return;
      }
      const sizeErrors = validateDimensions(dimensions.width, dimensions.height, complexity, formData.bodyPart);
      if (sizeErrors.length > 0) {
        window.alert(sizeErrors.join(' '));
        setIsLoading(false);
        return;
      }

      const payload = {
        country: modelCountry,
        city: modelCity,
        width_in: dimensions.width,
        height_in: dimensions.height,
        complexity,
        color: formData.inkColor === 'Colour' ? 'Colored' : 'Black_Gray',
        placement: formData.bodyPart || undefined,
      };

      const res = await fetch(`${API_BASE_URL}/api/price/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const responseData = await res.json() as ResultsDashboardData['price_prediction'] & { detail?: string };
      if (!res.ok) {
        throw new Error(responseData.detail || 'Unable to estimate the tattoo price.');
      }
      const priceData: ResultsDashboardData['price_prediction'] = responseData;

      setResultsData({
        price_prediction: priceData,
        health_assessment: {
          category: formData.health.diabetes ? "Medical consultation recommended" : 
                    (formData.health.allergies || formData.health.skinConditions) ? "Caution" : "Lower concern",
          factors: formData.health.diabetes ? ["Diabetes"] : 
                   (formData.health.allergies ? ["Allergies"] : []),
          explanation: "Based on the provided information, a preliminary risk assessment was made. This is an AI assessment and does not constitute medical advice.",
          sources: []
        },
        designText: formData.designType === 'text' && formData.designText.trim() ? formData.designText : `${formData.inkColor !== 'No Preference' ? formData.inkColor + ' ' : ''}${sizeLabel} tattoo design`,
        city: formData.city,
        country: formData.country,
        countryCode: 'IN',
        skinTone: formData.skinTone,
        inkColor: formData.inkColor,
        inkBrand: formData.inkBrand,
        sizeLabel
      });
      setShowResults(true);
    } catch (error) {
      console.error(error);
      // Fallback if backend fails
      setResultsData({
        price_prediction: {
          predicted_price_mid: 13500,
          predicted_price_min: 9000,
          predicted_price_max: 18000,
          factors: ["Price service unavailable; showing a typical range", `Size: ${sizeLabel}`, `Location: ${formData.city}, India`]
        },
        health_assessment: { category: "Lower concern", factors: [], explanation: "Fallback", sources: [] },
        designText: formData.designType === 'text' && formData.designText.trim() ? formData.designText : `${formData.inkColor !== 'No Preference' ? formData.inkColor + ' ' : ''}${sizeLabel} tattoo design`, city: formData.city, country: 'India', countryCode: 'IN', skinTone: formData.skinTone, inkColor: formData.inkColor, sizeLabel
      });
      setShowResults(true);
    }
    setIsLoading(false);
  };



  const steps = [
    'Health Information',
    'Skin Tone',
    'Tattoo Design',
    'Ink Color & Brand',
    'Size & Location',
    'Results'
  ];

  const handleNext = () => setCurrentStep(c => Math.min(c + 1, steps.length - 1));
  const handlePrev = () => setCurrentStep(c => Math.max(c - 1, 0));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col">
      {/* Header */}
      <header className="p-6 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center sticky top-0 z-50 backdrop-blur-md">
        <Link href="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
          Tattoo AI
        </Link>
        
        {/* Progress Tracker */}
        <div className="hidden md:flex items-center space-x-2">
          {steps.map((step, idx) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                idx === currentStep ? 'bg-purple-600 text-white' : 
                idx < currentStep ? 'bg-purple-900 text-purple-300' : 'bg-slate-800 text-slate-500'
              }`}>
                {idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-12 h-1 mx-2 rounded ${idx < currentStep ? 'bg-purple-800' : 'bg-slate-800'}`}></div>
              )}
            </div>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-12 flex flex-col">
        <h2 className="text-3xl font-bold mb-8">{steps[currentStep]}</h2>

        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-10 shadow-xl shadow-black/50">
          {currentStep === 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-blue-900/20 border border-blue-800/50 p-4 rounded-xl mb-6">
                <p className="text-blue-200 text-sm">
                  <span className="font-bold">Important:</span> This AI-generated assessment is for informational purposes only and is not medical advice. Consult a qualified healthcare professional before getting a tattoo if you have a medical condition, allergy, skin condition, or other health concern.
                </p>
              </div>
              
              <div className="space-y-4">
                {[
                  { id: 'conditions', label: 'Do you have any general medical conditions?' },
                  { id: 'skinConditions', label: 'Do you have any skin conditions (e.g., eczema, psoriasis)?' },
                  { id: 'allergies', label: 'Do you have any known allergies (especially to inks/pigments)?' },
                  { id: 'diabetes', label: 'Do you have diabetes?' },
                  { id: 'immune', label: 'Do you have an immune-system-related condition?' },
                  { id: 'healing', label: 'Do you have a history of poor wound healing or abnormal scarring?' },
                  { id: 'meds', label: 'Are you taking any medications that affect bleeding or healing?' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:bg-slate-800 transition-colors">
                    <span className="text-slate-300">{item.label}</span>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => setFormData(d => ({ ...d, health: { ...d.health, [item.id]: true } }))}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${formData.health[item.id as keyof typeof formData.health] === true ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                        Yes
                      </button>
                      <button 
                        onClick={() => setFormData(d => ({ ...d, health: { ...d.health, [item.id]: false } }))}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${formData.health[item.id as keyof typeof formData.health] === false ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                        No
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentStep === 1 && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <p className="text-slate-400 mb-6">Select the skin tone that closest matches yours. This is used for aesthetic ink color recommendations, not for medical classification.</p>
               
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 {[
                   { id: 'Type 1', color: 'bg-[#f4d0b0]', label: 'Very Light' },
                   { id: 'Type 2', color: 'bg-[#e7b78f]', label: 'Light' },
                   { id: 'Type 3', color: 'bg-[#d09e74]', label: 'Medium Light' },
                   { id: 'Type 4', color: 'bg-[#b07d54]', label: 'Medium Dark' },
                   { id: 'Type 5', color: 'bg-[#895632]', label: 'Dark' },
                   { id: 'Type 6', color: 'bg-[#4f2f1d]', label: 'Very Dark' },
                 ].map(tone => (
                   <button 
                     key={tone.id}
                     onClick={() => setFormData(d => ({ ...d, skinTone: tone.id }))}
                     className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${formData.skinTone === tone.id ? 'border-purple-500 bg-slate-800' : 'border-transparent bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600'}`}
                   >
                     <div className={`w-16 h-16 rounded-full mb-3 ${tone.color} shadow-inner`}></div>
                     <span className="text-slate-300 font-medium">{tone.label}</span>
                   </button>
                 ))}
                 <button 
                    onClick={() => setFormData(d => ({ ...d, skinTone: 'Not Sure' }))}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${formData.skinTone === 'Not Sure' ? 'border-purple-500 bg-slate-800' : 'border-transparent bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600'}`}
                  >
                    <div className="w-16 h-16 rounded-full mb-3 bg-slate-700 flex items-center justify-center text-2xl">?</div>
                    <span className="text-slate-300 font-medium">Not Sure</span>
                  </button>
               </div>
             </div>
          )}

          {currentStep === 2 && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <p className="text-slate-400 mb-6">How would you like to provide your design idea?</p>
               
               <div className="flex space-x-4 mb-8">
                 {['text', 'none'].map(type => (
                   <button 
                     key={type}
                     onClick={() => setFormData(d => ({ ...d, designType: type }))}
                     className={`px-6 py-3 rounded-xl font-medium capitalize transition-colors ${formData.designType === type ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                   >
                     {type === 'none' ? 'No Idea Yet' : type}
                   </button>
                 ))}
               </div>

               {formData.designType === 'text' && (
                 <div>
                   <label className="block text-slate-300 mb-2 font-medium">Describe your tattoo idea</label>
                   <textarea 
                     className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-purple-500 focus:outline-none min-h-[150px]"
                     placeholder="e.g. A realistic lion with a clock and roses, approximately 6 inches wide..."
                     value={formData.designText}
                     onChange={(e) => setFormData(d => ({ ...d, designText: e.target.value }))}
                   />
                 </div>
               )}
               
               {/* Placeholders for AI Generate options */}
               {formData.designType === 'none' && (
                 <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                   <p className="text-slate-300">Continue with a general tattoo reference; you can add a visual reference image later.</p>
                 </div>
               )}
             </div>
          )}
          
          {currentStep === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <p className="text-slate-400 mb-6">Select your preferred type of color, or choose &apos;No Preference&apos; to let our AI recommend the best colors for your skin tone and design.</p>
               
               <div className="grid grid-cols-2 gap-4 max-w-md">
                 {[
                   { id: 'Black', color: 'bg-black' },
                   { id: 'Colour', color: 'bg-gradient-to-tr from-red-500 via-green-500 to-blue-500' },
                 ].map(ink => (
                   <button 
                     key={ink.id}
                     onClick={() => setFormData(d => ({ ...d, inkColor: ink.id }))}
                     className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${formData.inkColor === ink.id ? 'border-purple-500 bg-slate-800' : 'border-transparent bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600'}`}
                   >
                     <div className={`w-12 h-12 rounded-full mb-3 shadow-inner ${ink.color}`}></div>
                     <span className="text-slate-300 font-medium">{ink.id}</span>
                   </button>
                 ))}
               </div>

               <div className="mt-10">
                 <h3 className="text-xl font-bold text-slate-200 mb-4">Type of Ink</h3>
                 <p className="text-slate-400 mb-4 text-sm">Choose a specific brand or select &apos;No Preference&apos;.</p>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                   {['Eternal Ink', 'Dynamic Color', 'Intenze Tattoo Ink', 'Kuro Sumi', 'Xtreme Ink', 'No Preference'].map(brand => (
                     <button
                       key={brand}
                       onClick={() => setFormData(d => ({ ...d, inkBrand: brand }))}
                       className={`p-4 rounded-xl border-2 transition-all text-center ${formData.inkBrand === brand ? 'border-purple-500 bg-slate-800' : 'border-transparent bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600'}`}
                     >
                       <span className="text-slate-300 font-medium">{brand}</span>
                     </button>
                   ))}
                 </div>
               </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="mb-10">
                 <h3 className="text-xl font-bold text-slate-200 mb-4">Tattoo Size</h3>
                 <TattooSizePicker
                   value={dimensions}
                   complexity={complexity}
                   placement={formData.bodyPart}
                   onChange={setDimensions}
                   variant="dark"
                 />
               </div>

               <div>
                 <h3 className="text-xl font-bold text-slate-200 mb-4">Your Location</h3>
                 <p className="text-slate-400 mb-4 text-sm">Choose or enter any Indian city or town. GPS can detect your current location in India.</p>
                 <button 
                   onClick={() => {
                     if (navigator.geolocation) {
                       setLocationStatus('Finding your current location...');
                       navigator.geolocation.getCurrentPosition(async (position) => {
                         try {
                           const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`);
                           if (!res.ok) throw new Error(`Location lookup failed with HTTP ${res.status}.`);
                           const data = await res.json() as { city?: string; locality?: string; countryCode?: string };
                           if (data.countryCode?.toUpperCase() !== 'IN') {
                             setLocationStatus('GPS location must be in India. Enter an Indian city instead.');
                           } else {
                             const city = data.city?.trim() || data.locality?.trim();
                             if (!city) {
                               setLocationStatus('Could not identify your city. Enter it manually.');
                               return;
                             }
                             setFormData(d => ({ 
                               ...d, 
                               city,
                               country: 'India',
                               countryCode: 'IN'
                             }));
                             setLocationStatus(`Using your current location: ${city}, India.`);
                           }
                         } catch(e) { 
                           console.error("GPS Error:", e); 
                           setLocationStatus('Could not look up your GPS location. Enter an Indian city instead.');
                         }
                       }, (error) => {
                         console.error("Geolocation Error:", error);
                         setLocationStatus(`GPS location failed: ${error.message}`);
                       });
                     } else {
                       setLocationStatus('GPS location is not supported by this browser.');
                     }
                   }}
                   className="mb-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg flex items-center transition-colors"
                 >
                   <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                   Use My GPS Location
                 </button>
                 {locationStatus && <p role="status" className="mb-4 text-sm text-slate-300">{locationStatus}</p>}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                     <span className="block text-slate-300 mb-2 font-medium">Country</span>
                     <div className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200">India</div>
                   </div>
                   <div>
                     <label className="block text-slate-300 mb-2 font-medium">Indian city or town</label>
                     <input 
                       type="text"
                       list="dataset-cities"
                       placeholder="Search or enter an Indian city"
                       className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                       value={formData.city}
                       onChange={(e) => setFormData(d => ({ ...d, city: e.target.value, country: 'India', countryCode: 'IN' }))}
                     />
                     <datalist id="dataset-cities">
                       {cityOptions.map((city) => <option key={city} value={city} />)}
                     </datalist>
                   </div>
                 </div>
               </div>
            </div>
          )}

          {currentStep === steps.length - 1 && (
            !showResults ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-12">
                 <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-6">
                   <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                 </div>
                 <h3 className="text-2xl font-bold text-slate-200 mb-4">Ready for Analysis</h3>
                 <p className="text-slate-400 mb-8 max-w-md mx-auto">We have collected all your preferences. Our AI will now generate your personalized tattoo plan, price estimate, and health considerations.</p>
                 
                 <button 
                   onClick={fetchResults}
                   disabled={isLoading}
                   className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-full hover:shadow-lg hover:shadow-purple-500/30 transition-all hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed">
                   {isLoading ? 'Analyzing...' : 'Generate My Tattoo Plan'}
                 </button>
              </div>
            ) : (
              <ResultsDashboard data={resultsData} />
            )
          )}

        </div>

        {/* Navigation (hide when showing results) */}
        {!showResults && (
          <div className="mt-8 flex justify-between">
            <button 
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`px-6 py-3 rounded-full font-bold transition-colors ${currentStep === 0 ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
            >
              Back
            </button>
            
            {currentStep < steps.length - 1 && (
              <button 
                onClick={handleNext}
                className="px-8 py-3 bg-purple-600 text-white font-bold rounded-full hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/50"
              >
                Continue
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
