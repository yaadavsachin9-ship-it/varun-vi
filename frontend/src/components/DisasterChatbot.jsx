/**
 * VARUN-VI SAHAYAK (वरुण-VI सहायक)
 * Autonomous Bilingual Voice-Enabled Early Warning & Emergency Response Chatbot.
 *
 * Strict Color System Compliant:
 * - App Background: #061826
 * - Sidebar/Header: #071F30, Border: #164E63
 * - Primary Cards/Container: #0B2638
 * - Secondary Panels/User Bubbles: #10384A
 * - Brand Primary: #06B6D4, Hover: #22D3EE
 * - Text Primary: #F8FAFC, Text Secondary: #94A3B8
 * - Status: Safe #10B981, Warning #FBBF24, High #F97316, Critical #EF4444
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Mic, MicOff, Volume2, VolumeX, Send, X,
  Maximize2, Minimize2, PhoneCall, Navigation, Sparkles
} from 'lucide-react';
import { useRiskData } from '../context/RiskDataContext';

// Official Emergency Helplines for Uttarakhand Himalayan Region
const HELPLINES = [
  { name: 'National Disaster Response Force (NDRF)', name_hi: 'एनडीआरएफ (NDRF)', num: '1078', tel: '1078' },
  { name: 'Uttarakhand State Emergency Operation Centre', name_hi: 'उत्तराखंड आपदा नियंत्रण केंद्र', num: '1070', tel: '1070' },
  { name: 'District Disaster Control Chamoli', name_hi: 'चमोली जिला आपदा नियंत्रण', num: '01372-251077', tel: '+911372251077' },
  { name: 'SDRF Uttarakhand Helpline', name_hi: 'एसडीआरएफ हेल्पलाइन', num: '9411112985', tel: '+919411112985' },
  { name: 'Police / Emergency Response', name_hi: 'पुलिस आपातकालीन सेवा', num: '112', tel: '112' },
  { name: 'Medical Emergency & Ambulance', name_hi: 'एम्बुलेंस चिकित्सा सहायता', num: '108', tel: '108' },
];

export default function DisasterChatbot() {
  const { villages = [], criticalCount = 0, wsConnected } = useRiskData();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [language, setLanguage] = useState('hi'); // 'en' | 'hi'
  const [inputMessage, setInputMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [activeSpeechId, setActiveSpeechId] = useState(null);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const currentUtteranceRef = useRef(null);
  const handleSendMessageRef = useRef(null);

  // Initialize Speech Recognition (STT)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputMessage(transcript);
          // Auto submit after voice input
          setTimeout(() => {
            if (handleSendMessageRef.current) {
              handleSendMessageRef.current(transcript);
            }
          }, 300);
        }
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language]);

  // Initial welcome message
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      lang: 'hi',
      text: 'नमस्ते! मैं वरुण-VI (VARUN-VI) आपातकालीन आपदा सहायक हूँ। मैं आपको हिमालयी क्षेत्रों में बाढ़, वर्षा, जलस्तर, सुरक्षित शरणस्थलों और निकासी मार्गों की ताज़ा जानकारी दे सकता हूँ। आप लिखकर या माइक पर बोलकर पूछ सकते हैं।',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickActions: [
        { label: '🚨 क्या कोई खतरा है?', action: 'क्या कोई गाँव खतरे में है?' },
        { label: '📍 जोशीमठ की स्थिति', action: 'जोशीमठ का लाइव स्टेटस बताओ' },
        { label: '🏃 सुरक्षित शरणस्थल', action: 'नज़दीकी सुरक्षित आश्रय कहाँ हैं?' },
        { label: '📞 हेल्पलाइन नंबर', action: 'आपातकालीन हेल्पलाइन नंबर बताएं' }
      ]
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Clean text for speech synthesis (strips markdown, links, emoji)
  const sanitizeTextForVoice = (text) => {
    return text
      .replace(/[*#_~`>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Text-To-Speech (TTS)
  const speakText = (text, messageId, forceLang) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    if (activeSpeechId === messageId) {
      setActiveSpeechId(null);
      setIsSpeaking(false);
      return;
    }

    const clean = sanitizeTextForVoice(text);
    const utterance = new SpeechSynthesisUtterance(clean);
    
    // Auto-detect Hindi characters or use language state
    const hasHindi = /[\u0900-\u097F]/.test(clean);
    const targetLang = forceLang || (hasHindi ? 'hi-IN' : 'en-IN');
    utterance.lang = targetLang;

    // Pick best available voice
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(v => v.lang === targetLang || v.lang.startsWith(targetLang.slice(0, 2)));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.rate = targetLang.startsWith('hi') ? 0.95 : 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setActiveSpeechId(messageId);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setActiveSpeechId(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setActiveSpeechId(null);
    };

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setActiveSpeechId(null);
    }
  };

  // Toggle voice recording
  const handleMicToggle = () => {
    if (!recognitionRef.current) {
      alert(language === 'hi' 
        ? 'आपके ब्राउज़र में आवाज़ इनपुट समर्थित नहीं है। कृपया Google Chrome या Edge का उपयोग करें।' 
        : 'Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      stopSpeaking();
      try {
        recognitionRef.current.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
        recognitionRef.current.start();
      } catch (err) {
        console.error('Mic start error:', err);
      }
    }
  };

  // Intelligent disaster response engine
  const generateResponse = (query) => {
    const q = query.toLowerCase().trim();
    const isHindiQuery = /[\u0900-\u097F]/.test(q) || 
      q.includes('kya') || q.includes('kaun') || q.includes('namaste') || q.includes('madad') || q.includes('batao') || q.includes('safe hai');
    const isHindi = language === 'hi' || isHindiQuery;

    // 1. Critical alerts & overview query
    if (q.includes('critical') || q.includes('khatra') || q.includes('red alert') || q.includes('danger') || q.includes('खतरा') || q.includes('अलर्ट') || q.includes('safe') || q.includes('सुरक्षित')) {
      const redVillages = villages.filter(v => (v.current_risk_score >= 70) || v.current_risk_level === 'red');
      const yellowVillages = villages.filter(v => (v.current_risk_score >= 40 && v.current_risk_score < 70) || v.current_risk_level === 'yellow');

      if (isHindi) {
        if (redVillages.length > 0) {
          const list = redVillages.map(v => `• ${v.name} (जोखिम: ${Math.round(v.current_risk_score)}/100, संभावित समय: ${v.current_lead_time_hrs} घंटे)`).join('\n');
          return {
            text: `⚠️ चेतावनी! वर्तमान में ${redVillages.length} गाँव गंभीर खतरे (RED ALERT) में हैं:\n${list}\n\nनिकासी तुरंत शुरू करें और नदी किनारों से दूर ऊँचे क्षेत्रों में जाएँ।`,
            badge: 'CRITICAL',
            actionVillageId: redVillages[0]?.id
          };
        } else if (yellowVillages.length > 0) {
          return {
            text: `🟡 ध्यान दें: कोई गाँव रेड अलर्ट पर नहीं है, लेकिन ${yellowVillages.length} गाँव मध्यम चेतावनी (YELLOW WATCH) पर हैं। सतर्क रहें और स्थानीय प्रशासन के निर्देशों का पालन करें।`,
            badge: 'WARNING'
          };
        } else {
          return {
            text: `🟢 सभी क्षेत्र वर्तमान में सुरक्षित (GREEN ZONE) में हैं। सभी 10 मॉनिटरिंग स्टेशनों पर जलस्तर और वर्षा सामान्य सीमा में हैं।`,
            badge: 'SAFE'
          };
        }
      } else {
        if (redVillages.length > 0) {
          const list = redVillages.map(v => `• ${v.name} (Risk: ${Math.round(v.current_risk_score)}/100, Lead Time: ${v.current_lead_time_hrs}h)`).join('\n');
          return {
            text: `⚠️ CRITICAL ALERT! There are ${redVillages.length} sector(s) currently under RED ALERT:\n${list}\n\nImmediate evacuation advised to higher ground shelters.`,
            badge: 'CRITICAL',
            actionVillageId: redVillages[0]?.id
          };
        } else {
          return {
            text: `🟢 System is NOMINAL. All ${villages.length} monitored sectors are operating under safe hydrological parameters. No active red alerts.`,
            badge: 'SAFE'
          };
        }
      }
    }

    // 2. Specific village status query
    const matchedVillage = villages.find(v => {
      const name = v.name.toLowerCase();
      return q.includes(name) || 
        (name.includes('raini') && (q.includes('रैणी') || q.includes('रेणी') || q.includes('raini') || q.includes('reni'))) ||
        (name.includes('joshimath') && (q.includes('जोशीमठ') || q.includes('joshimath'))) ||
        (name.includes('tapovan') && (q.includes('तपोवन') || q.includes('tapovan'))) ||
        (name.includes('helang') && (q.includes('हेलंग') || q.includes('helang'))) ||
        (name.includes('lata') && (q.includes('लता') || q.includes('lata'))) ||
        (name.includes('pandukeshwar') && (q.includes('पांडुकेश्वर') || q.includes('pandukeshwar'))) ||
        (name.includes('dhak') && (q.includes('ढाक') || q.includes('dhak'))) ||
        (name.includes('suraithota') && (q.includes('सुरैथोता') || q.includes('suraithota')));
    });

    if (matchedVillage) {
      const score = Math.round(matchedVillage.current_risk_score || 0);
      const level = matchedVillage.current_risk_level || (score >= 70 ? 'red' : score >= 40 ? 'yellow' : 'green');
      const rain = (matchedVillage.latest_rainfall_mm ?? 0).toFixed(1);
      const stream = (matchedVillage.latest_stream_level_m ?? 0).toFixed(2);
      const soil = (matchedVillage.latest_soil_moisture_pct ?? 0).toFixed(1);
      const leadTime = matchedVillage.current_lead_time_hrs ?? 6.0;

      if (isHindi) {
        return {
          text: `📍 ${matchedVillage.name} स्थिति रिपोर्ट:\n` +
            `• जोखिम स्तर: ${level === 'red' ? '🔴 गंभीर (CRITICAL)' : level === 'yellow' ? '🟡 चेतावनी (WATCH)' : '🟢 सामान्य (SAFE)'} (${score}/100)\n` +
            `• संभावित बाढ़ समय (Lead Time): ${leadTime} घंटे\n` +
            `• ताज़ा बारिश: ${rain} mm/h\n` +
            `• नदी जलस्तर: ${stream} m (बाढ़ सीमा: 2.5 m)\n` +
            `• मिट्टी नमी (Soil Moisture): ${soil}%\n` +
            `• नदी बेसिन: ${matchedVillage.river_basin || 'अलकनंदा घाटी'}`,
          badge: level === 'red' ? 'CRITICAL' : level === 'yellow' ? 'WARNING' : 'SAFE',
          actionVillageId: matchedVillage.id
        };
      } else {
        return {
          text: `📍 Live Status for ${matchedVillage.name}:\n` +
            `• Risk Score: ${score}/100 (${level.toUpperCase()})\n` +
            `• Modelled Lead Time: ${leadTime} hrs\n` +
            `• Rainfall Rate: ${rain} mm/h\n` +
            `• Stream Level: ${stream} m (Flood threshold: 2.5m)\n` +
            `• Soil Moisture: ${soil}%\n` +
            `• Basin: ${matchedVillage.river_basin || 'Alaknanda'}`,
          badge: level === 'red' ? 'CRITICAL' : level === 'yellow' ? 'WARNING' : 'SAFE',
          actionVillageId: matchedVillage.id
        };
      }
    }

    // 3. Evacuation / Shelters query
    if (q.includes('evacuat') || q.includes('shelter') || q.includes('bachav') || q.includes('निकासी') || q.includes('शरण') || q.includes('रास्ता') || q.includes('आश्रय')) {
      if (isHindi) {
        return {
          text: `🏃 आपातकालीन निकासी एवं आश्रय निर्देश:\n` +
            `1. हमेशा घाटी की ओर जाने के बजाय ऊपर पहाड़ी की तरफ सुरक्षित उच्च स्थानों (Ridge Shelters) की ओर बढ़ें।\n` +
            `2. प्राथमिक सुरक्षित आश्रय: राजकीय इंटर कॉलेज भवन, हेलीपैड ग्राउंड और स्थानीय सामुदायिक केंद्र।\n` +
            `3. पुलों, संकरी घाटियों और जलधाराओं के पास बिल्कुल न रुकें।\n` +
            `4. अधिकृत रूट देखने के लिए नीचे दिए गए बटन पर क्लिक करें।`,
          quickActions: [
            { label: '🗺️ निकासी रूट देखें', action: 'रूट खोलो' },
            { label: '📞 हेल्पलाइन नंबर', action: 'हेल्पलाइन नंबर' }
          ]
        };
      } else {
        return {
          text: `🏃 Evacuation & Safe Shelter Protocol:\n` +
            `1. Move perpendicular to the valley slope to designated uphill ridge shelters.\n` +
            `2. Primary Safe Havens: High-altitude Inter Colleges, Army/SDRF helipads, and concrete community centres (>60m elevation margin).\n` +
            `3. Avoid riverbanks, culverts, and suspension bridges during surging water.\n` +
            `4. Check the Evacuation Route panel for live Tobler-hiking walking times.`,
          quickActions: [
            { label: '🗺️ Open Evacuation Plans', action: 'Open evacuation' },
            { label: '📞 Emergency Contacts', action: 'Helplines' }
          ]
        };
      }
    }

    // 4. Helplines / Emergency numbers
    if (q.includes('help') || q.includes('phone') || q.includes('number') || q.includes('contact') || q.includes('हेल्प') || q.includes('नंबर') || q.includes('संपर्क') || q.includes('मदद')) {
      if (isHindi) {
        return {
          text: `📞 24x7 आपातकालीन सहायता हेल्पलाइन:\n` +
            `• राष्ट्रीय आपदा राहत बल (NDRF): 1078\n` +
            `• उत्तराखंड आपदा कंट्रोल रूम (SEOC): 1070\n` +
            `• चमोली जिला आपदा कंट्रोल: 01372-251077\n` +
            `• एसडीआरएफ (SDRF) कंट्रोल: 9411112985\n` +
            `• पुलिस आपातकाल: 112 | एम्बुलेंस: 108`,
          helplines: true
        };
      } else {
        return {
          text: `📞 Official 24x7 Emergency Helplines:\n` +
            `• NDRF National Helpline: 1078\n` +
            `• State Emergency Control Room (SEOC): 1070\n` +
            `• District Disaster Ops (Chamoli): 01372-251077\n` +
            `• SDRF Operations: +91 9411112985\n` +
            `• Police / Emergency: 112 | Medical: 108`,
          helplines: true
        };
      }
    }

    // 5. Rainfall & Weather
    if (q.includes('rain') || q.includes('weather') || q.includes('barish') || q.includes('बारिश') || q.includes('मौसम') || q.includes('precipitation')) {
      const highestRainVillage = [...villages].sort((a, b) => (b.latest_rainfall_mm || 0) - (a.latest_rainfall_mm || 0))[0];
      if (isHindi) {
        return {
          text: `🌧️ मौसम और वर्षा टेलीमेट्री:\n` +
            `• सबसे अधिक वर्षा वाला क्षेत्र: ${highestRainVillage ? highestRainVillage.name : 'तपोवन'} (${highestRainVillage ? (highestRainVillage.latest_rainfall_mm ?? 0).toFixed(1) : '0'} mm/h)\n` +
            `• बादल फटने (Cloudburst) की सीमा: 50 mm/h\n` +
            `• लाइव सेंसर ग्रिड: मौसम विज्ञान उपग्रह एवं स्थानीय IoT वर्षामापी सेंसर सक्रिय हैं।`,
          badge: (highestRainVillage?.latest_rainfall_mm > 40) ? 'WARNING' : 'SAFE'
        };
      } else {
        return {
          text: `🌧️ Telemetry & Precipitation Report:\n` +
            `• Peak Rain Rate: ${highestRainVillage?.name || 'Tapovan'} at ${(highestRainVillage?.latest_rainfall_mm ?? 0).toFixed(1)} mm/h\n` +
            `• Cloudburst Threshold: 50.0 mm/h\n` +
            `• Real-time IoT sensors and IMD radar feeds are streaming live via WebSocket.`,
          badge: (highestRainVillage?.latest_rainfall_mm > 40) ? 'WARNING' : 'SAFE'
        };
      }
    }

    // 6. How VARUN-VI works / System info
    if (q.includes('varun') || q.includes('system') || q.includes('model') || q.includes('वरुण') || q.includes('कैसे') || q.includes('kaise')) {
      if (isHindi) {
        return {
          text: `🛰️ वरुण-VI (VARUN-VI) सिस्टम के बारे में:\n` +
            `• यह उच्च हिमालयी क्षेत्रों के लिए डिज़ाइन किया गया फिजिक्स-इन्फॉर्म्ड AI अर्ली वार्निंग सिस्टम है।\n` +
            `• इसमें बारिश, मिट्टी की नमी, सिस्मिक कंपन और ढलान के आधार पर 1 से 12 घंटे पहले संभावित बाढ़ का सटीक अनुमान लगाया जाता है।\n` +
            `• यह राष्ट्रीय आपदा प्रबंधन प्राधिकरण (NDMA) और SACHET CAP प्रोटोकॉल से सीधे जुड़ा हुआ है।`,
        };
      } else {
        return {
          text: `🛰️ About VARUN-VI System:\n` +
            `• Physics-informed hybrid Random Forest Early Warning System for Himalayan flash floods.\n` +
            `• Evaluates kinematic wave routing, soil pore-water pressure, and slope geotechnical stability.\n` +
            `• Computes actionable Lead Time (TTI) and broadcasts CAP/SACHET evacuation warnings to local towers.`,
        };
      }
    }

    // Default Fallback
    if (isHindi) {
      return {
        text: `मैं आपकी बात समझ रहा हूँ। आप मुझसे किसी भी गाँव का नाम (जैसे रैणी, जोशीमठ, तपोवन), वर्तमान खतरे का स्तर, नज़दीकी शेल्टर या आपातकालीन नंबर पूछ सकते हैं।`,
        quickActions: [
          { label: '🚨 क्या कोई खतरा है?', action: 'क्या कोई गाँव खतरे में है?' },
          { label: '📍 रैणी गाँव का स्टेटस', action: 'रैणी का स्टेटस बताओ' },
          { label: '📞 हेल्पलाइन नंबर', action: 'हेल्पलाइन नंबर बताओ' }
        ]
      };
    } else {
      return {
        text: `I'm here to help. You can ask for real-time status of any village (e.g. Raini, Joshimath, Tapovan), active warnings, nearest evacuation shelters, or emergency helplines.`,
        quickActions: [
          { label: '🚨 Check Critical Sectors', action: 'Any critical danger?' },
          { label: '📍 Raini Status', action: 'Status of Raini' },
          { label: '📞 Emergency Helplines', action: 'Emergency numbers' }
        ]
      };
    }
  };

  const handleSendMessage = (textToSend) => {
    const query = (textToSend || inputMessage).trim();
    if (!query) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');

    // Generate bot reply
    setTimeout(() => {
      const responseData = generateResponse(query);
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: responseData.text,
        badge: responseData.badge,
        actionVillageId: responseData.actionVillageId,
        helplines: responseData.helplines,
        quickActions: responseData.quickActions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);

      // Automatically speak response if enabled
      if (autoSpeak) {
        speakText(responseData.text, botMsg.id);
      }
    }, 350);
  };
  handleSendMessageRef.current = handleSendMessage;

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2">
        {!isOpen && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#071F30] border border-[#164E63] text-[#F8FAFC] shadow-xl text-xs font-semibold backdrop-blur animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-[#06B6D4] animate-ping" />
            <span className="text-[#06B6D4]">VARUN-VI SAHAYAK</span>
            <span className="text-[#94A3B8]">• {language === 'hi' ? 'आपातकालीन AI सहायक' : 'Disaster AI Voice Assistant'}</span>
          </div>
        )}

        <button
          onClick={() => {
            setIsOpen(prev => !prev);
            if (isSpeaking) stopSpeaking();
          }}
          className="relative w-14 h-14 rounded-full bg-[#06B6D4] hover:bg-[#22D3EE] text-[#061826] shadow-[0_0_24px_rgba(6,182,212,0.45)] border-2 border-[#164E63] flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95"
          title="Open VARUN-VI AI Emergency Voice Assistant"
          aria-label="VARUN-VI Emergency Assistant"
        >
          {isOpen ? (
            <X className="w-6 h-6 stroke-[2.5]" />
          ) : (
            <>
              <MessageSquare className="w-6 h-6 stroke-[2.5]" />
              {criticalCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#EF4444] text-[#F8FAFC] text-[10px] font-bold flex items-center justify-center border-2 border-[#061826] animate-pulse">
                  {criticalCount}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* Chatbot Window */}
      {isOpen && (
        <div
          className={`fixed z-[9998] transition-all duration-300 ease-out flex flex-col overflow-hidden rounded-xl border border-[#164E63] bg-[#0B2638] shadow-[0_20px_60px_rgba(0,0,0,0.65)] ${
            isExpanded
              ? 'inset-3 sm:inset-6 md:inset-10'
              : 'bottom-20 right-3 sm:right-6 w-[94vw] sm:w-[420px] max-h-[82vh] h-[640px]'
          }`}
          style={{ backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="bg-[#071F30] border-b border-[#164E63] p-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-9 h-9 rounded-lg bg-[#10384A] border border-[#164E63] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-[#06B6D4]" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] border border-[#071F30]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-[#F8FAFC] truncate">
                    {language === 'hi' ? 'वरुण-VI सहायक (AI)' : 'VARUN-VI Sahayak'}
                  </h3>
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-[#06B6D4]/15 border border-[#164E63] text-[#06B6D4]">
                    Live
                  </span>
                </div>
                <p className="text-[10px] text-[#94A3B8] truncate">
                  {language === 'hi' ? 'द्विभाषी आपदा एवं पूर्व चेतावनी सहायक' : 'Bilingual Voice & Emergency Intel'}
                </p>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-1.5">
              {/* Language Switcher */}
              <button
                onClick={() => {
                  stopSpeaking();
                  setLanguage(prev => (prev === 'hi' ? 'en' : 'hi'));
                }}
                className="px-2 py-1 rounded bg-[#10384A] border border-[#164E63] text-[#F8FAFC] text-[10px] font-bold hover:border-[#06B6D4] transition"
                title="Switch Language / भाषा बदलें"
              >
                {language === 'hi' ? 'English' : 'हिन्दी'}
              </button>

              {/* Auto Speak Toggle */}
              <button
                onClick={() => {
                  if (isSpeaking) stopSpeaking();
                  setAutoSpeak(prev => !prev);
                }}
                className={`w-7 h-7 rounded flex items-center justify-center border transition ${
                  autoSpeak
                    ? 'bg-[#06B6D4]/15 border-[#06B6D4] text-[#06B6D4]'
                    : 'bg-[#10384A] border-[#164E63] text-[#94A3B8]'
                }`}
                title={autoSpeak ? 'Voice output enabled' : 'Voice output muted'}
              >
                {autoSpeak ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Expand Toggle */}
              <button
                onClick={() => setIsExpanded(prev => !prev)}
                className="w-7 h-7 rounded bg-[#10384A] border border-[#164E63] text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center transition"
                title={isExpanded ? 'Restore window size' : 'Expand window size'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>

              {/* Close Button */}
              <button
                onClick={() => {
                  stopSpeaking();
                  setIsOpen(false);
                }}
                className="w-7 h-7 rounded bg-[#10384A] border border-[#164E63] text-[#94A3B8] hover:text-[#EF4444] hover:border-[#EF4444] flex items-center justify-center transition"
                title="Close chat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Telemetry Status Strip */}
          <div className="bg-[#071F30]/90 border-b border-[#164E63] px-3.5 py-1.5 flex items-center justify-between text-[10px] text-[#94A3B8]">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
              <span>{wsConnected ? (language === 'hi' ? 'सेंसर ग्रिड सक्रिय' : 'Live IoT Grid Active') : 'Offline'}</span>
            </div>
            <div className="flex items-center gap-2">
              {criticalCount > 0 ? (
                <span className="text-[#EF4444] font-bold">⚠️ {criticalCount} {language === 'hi' ? 'रेड अलर्ट' : 'Red Alerts'}</span>
              ) : (
                <span className="text-[#10B981] font-semibold">🟢 {language === 'hi' ? 'सुरक्षित स्थिति' : 'Nominal'}</span>
              )}
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#0B2638]/70">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-xl p-3 text-xs leading-relaxed border transition-all ${
                    msg.sender === 'user'
                      ? 'bg-[#10384A] border-[#164E63] text-[#F8FAFC]'
                      : 'bg-[#071F30] border-[#164E63] text-[#F8FAFC] shadow-sm'
                  }`}
                >
                  {/* Bot Badge Tag if present */}
                  {msg.badge && (
                    <div className="mb-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          msg.badge === 'CRITICAL'
                            ? 'bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444]'
                            : msg.badge === 'WARNING'
                            ? 'bg-[#FBBF24]/20 border border-[#FBBF24] text-[#FBBF24]'
                            : 'bg-[#10B981]/20 border border-[#10B981] text-[#10B981]'
                        }`}
                      >
                        {msg.badge === 'CRITICAL' ? '🔴 RED ALERT' : msg.badge === 'WARNING' ? '🟡 WATCH ALERT' : '🟢 SAFE'}
                      </span>
                    </div>
                  )}

                  {/* Message Body */}
                  <div className="whitespace-pre-line font-sans">{msg.text}</div>

                  {/* Village Deep Link Action */}
                  {msg.actionVillageId && (
                    <div className="mt-2.5 pt-2 border-t border-[#164E63] flex gap-2">
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          navigate(`/village/${msg.actionVillageId}`);
                        }}
                        className="px-2.5 py-1 rounded bg-[#06B6D4] text-[#061826] font-bold text-[10px] flex items-center gap-1 hover:bg-[#22D3EE] transition"
                      >
                        <Navigation className="w-3 h-3" />
                        {language === 'hi' ? 'गाँव का विस्तृत पेज खोलें' : 'Open Village Dashboard'}
                      </button>
                    </div>
                  )}

                  {/* Helplines Call Buttons */}
                  {msg.helplines && (
                    <div className="mt-2.5 pt-2 border-t border-[#164E63] grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {HELPLINES.slice(0, 4).map((h, i) => (
                        <a
                          key={i}
                          href={`tel:${h.tel}`}
                          className="flex items-center justify-between p-1.5 rounded bg-[#10384A] border border-[#164E63] hover:border-[#06B6D4] text-[10px] text-[#F8FAFC] transition"
                        >
                          <span className="truncate">{language === 'hi' ? h.name_hi : h.name}</span>
                          <span className="font-mono font-bold text-[#06B6D4] ml-1 flex items-center gap-0.5">
                            <PhoneCall className="w-2.5 h-2.5" /> {h.num}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Message Footer: Timestamp and Voice Action */}
                  <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-[#94A3B8]">
                    <span>{msg.timestamp}</span>
                    {msg.sender === 'bot' && (
                      <button
                        onClick={() => speakText(msg.text, msg.id)}
                        className={`flex items-center gap-1 hover:text-[#06B6D4] transition ${
                          activeSpeechId === msg.id ? 'text-[#06B6D4] font-bold' : ''
                        }`}
                        title="Listen to this message"
                      >
                        <Volume2 className="w-3 h-3" />
                        {activeSpeechId === msg.id 
                          ? (language === 'hi' ? 'बोल रहा है...' : 'Speaking...') 
                          : (language === 'hi' ? 'सुनें' : 'Listen')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Prompts under Bot Message */}
                {msg.quickActions && msg.quickActions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[95%]">
                    {msg.quickActions.map((qa, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(qa.action)}
                        className="px-2.5 py-1 rounded-full text-[10px] bg-[#10384A] border border-[#164E63] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#06B6D4] transition flex items-center gap-1 active:scale-95"
                      >
                        {qa.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Listening Active Waveform Banner */}
          {isListening && (
            <div className="bg-[#071F30] border-t border-[#06B6D4] px-4 py-2 flex items-center justify-between text-xs text-[#06B6D4] animate-pulse">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 animate-bounce text-[#22D3EE]" />
                <span className="font-semibold">
                  {language === 'hi' ? 'सुन रहा हूँ... कृपया बोलिए...' : 'Listening... Speak now...'}
                </span>
              </div>
              <button
                onClick={handleMicToggle}
                className="text-[10px] px-2 py-0.5 rounded bg-[#10384A] border border-[#164E63] text-[#F8FAFC]"
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
            </div>
          )}

          {/* Input Form Bar */}
          <div className="bg-[#071F30] border-t border-[#164E63] p-3 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={
                    language === 'hi'
                      ? 'पूछें: क्या मेरा गाँव सुरक्षित है? या माइक दबाएं...'
                      : 'Ask: Is Raini safe? What is the water level?...'
                  }
                  className="w-full pl-3 pr-10 py-2.5 rounded-lg bg-[#0B2638] border border-[#164E63] text-xs text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:border-[#06B6D4] focus:outline-none transition"
                />
              </div>

              {/* Voice Microphone Button */}
              <button
                type="button"
                onClick={handleMicToggle}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-[#EF4444] text-[#F8FAFC] animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                    : 'bg-[#10384A] border border-[#164E63] text-[#06B6D4] hover:bg-[#164E63] hover:text-[#22D3EE]'
                }`}
                title={language === 'hi' ? 'आवाज़ में बोलें (Microphone)' : 'Speak via Voice Input'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="w-10 h-10 rounded-lg bg-[#06B6D4] text-[#061826] flex items-center justify-center hover:bg-[#22D3EE] disabled:opacity-40 disabled:cursor-not-allowed transition font-bold"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between text-[9px] text-[#94A3B8]/70 px-1">
              <span>{language === 'hi' ? 'बोली समर्थित: हिन्दी / English' : 'Voice Enabled: English / Hindi'}</span>
              <span>NDRF / SDMA SIH-26192 AI Node</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
