/*
    data.js — Data layer for Harm Reduction Protocols Dashboard.
    
    Strategy: The canonical data lives in data/protocols.json for easy editing.
    This file attempts to fetch it. If that fails (file:// CORS), it falls back
    to the inline copy below. When updating data, edit protocols.json AND
    update the inline copy to keep them in sync.
*/

let protocols = {};

async function loadProtocolData() {
    // Try fetch first (works on HTTP servers / GitHub Pages)
    try {
        const response = await fetch('data/protocols.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        protocols = await response.json();
        console.log('[data] Loaded from protocols.json');
        return protocols;
    } catch (err) {
        console.warn('[data] Fetch failed, using inline data:', err.message);
    }

    // Fallback: inline data (mirror of protocols.json)
    protocols = _inlineProtocols;
    return protocols;
}

// ────────────────────────────────────────────
// INLINE COPY — keep in sync with data/protocols.json
// ────────────────────────────────────────────
const _inlineProtocols = {
    "sober": {
        "id": "sober",
        "name": "Sober / Baseline",
        "type": "Baseline",
        "emoji": "🧠",
        "color": "#78716c",
        "duration": 0,
        "routes": [
            {
                "name": "Baseline",
                "phases": null
            }
        ],
        "visualizer": {
            "neurotoxicity": 0,
            "cardiotoxicity": 0,
            "dehydration": 2,
            "sleep_deprivation": 2,
            "impulsivity": 0,
            "lethality": 0
        },
        "sleep_strategy": "Normal sleep cycle recommended. 9–10 hours pre-event banking.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Sleep banking: 9–10 hours per night for days prior.",
                        "detail": "Banking extra sleep beforehand (\"prophylactic sleep extension\") appears to build some reserve against the cognitive decline, slowed reaction times, and mood dips that come from staying up past your normal sleep window. The evidence is promising rather than fully settled, but there is no downside to arriving well-rested."
                    },
                    {
                        "short": "Nutrition: Complex carbohydrates + lean protein, 2–4 hours before.",
                        "detail": "Muscles rely heavily on glycogen during moderate-to-high-intensity activity. Whole grains, brown rice, or quinoa paired with lean proteins ensure gastric emptying is complete before vigorous movement, preventing GI distress while maximizing stored energy."
                    }
                ],
                "bonus": [
                    {
                        "short": "Hydration: Begin hydrating steadily in advance.",
                        "detail": "Avoid consuming large volumes at once — steady sipping is more effective at cellular hydration than rapid intake."
                    },
                    {
                        "short": "Nap: Consider a 20–90 minute afternoon nap.",
                        "detail": "A late-afternoon nap adds to your sleep reserve without disrupting nighttime sleep onset, provided it ends before 5 PM."
                    }
                ]
            },
            "during": {
                "focus": "Hydration balance and electrolyte maintenance.",
                "essential": [
                    {
                        "short": "Hydration: Water + electrolytes (sodium/potassium). Avoid plain water only.",
                        "detail": "Sweat contains roughly 200–700 mg sodium per hour. Drinking large volumes of plain water without replacing lost electrolytes dilutes blood sodium, risking exertional hyponatremia — a potentially fatal condition causing headaches, confusion, and seizures. Just as important: don't over-drink — match intake to thirst and sweat loss rather than forcing fluids."
                    },
                    {
                        "short": "Nutrition: Simple carbohydrates (fruit, applesauce) for rapid energy.",
                        "detail": "During vigorous activity, blood is diverted away from the GI tract toward muscles and skin. Fruits provide rapid glucose directly to working muscles without overburdening digestion."
                    }
                ],
                "bonus": [
                    {
                        "short": "Avoid high-fat or heavy protein foods during activity.",
                        "detail": "Dietary fats require prolonged digestion. Forcing the stomach to process heavy foods during exercise leads to bloating, nausea, and cramping due to reduced GI blood flow."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Hydration: Rehydrate with electrolytes.",
                        "detail": "Replace fluid and sodium lost during the event. A balanced electrolyte drink restores blood plasma volume and cellular hydration more effectively than plain water."
                    }
                ],
                "bonus": [
                    {
                        "short": "Recovery meal: Slow-digesting protein (casein/yogurt) + complex carbohydrates.",
                        "detail": "Consuming 20–40 g of casein protein before sleep provides a steady stream of amino acids for overnight muscle repair. Combining protein with carbohydrates supports tryptophan transport, enhancing serotonin and melatonin production for better sleep."
                    },
                    {
                        "short": "Supplements: Consider magnesium 1–2 hours before bed.",
                        "detail": "Magnesium acts as a natural calcium antagonist at the neuromuscular junction, facilitating muscle relaxation. It also stimulates GABA receptors, reducing excitatory neural activity and promoting deeper sleep."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Wake up: Expose eyes to natural sunlight promptly.",
                        "detail": "Remaining in bed past normal waking hours disrupts alignment between peripheral circadian clocks and the brain's master clock, causing prolonged grogginess, impaired cognition, and depressed mood."
                    }
                ],
                "bonus": [
                    {
                        "short": "Nutrition: High-protein breakfast + complex carbohydrates.",
                        "detail": "Blood glucose fluctuates after sleep deprivation. Eggs on whole-grain toast stabilize levels. Drink 500 ml water before caffeine — caffeine masks fatigue and acts as a mild diuretic."
                    },
                    {
                        "short": "Nap: 20–30 minutes before 3 PM if needed.",
                        "detail": "A short nap reduces sleep pressure and restores alertness without entering deep slow-wave sleep. Waking from deep sleep during the day causes significant grogginess."
                    }
                ]
            }
        },
        "risks": [
            "Exhaustion from prolonged exertion",
            "Dehydration and electrolyte imbalance",
            "Sleep deprivation and circadian disruption"
        ],
        "mcda": null,
        "visualizer_note": "Baseline physiological strain only, with no substance toxicity — the real risks of a long night are dehydration and sleep loss."
    },
    "alcohol": {
        "id": "alcohol",
        "name": "Alcohol",
        "type": "Depressant",
        "emoji": "🍺",
        "color": "#3b82f6",
        "duration": 4,
        "dosing": {
            "Oral": {
                "unit": "g ethanol (1 drink ≈ 10 g)",
                "threshold": 10,
                "light": {
                    "min": 10,
                    "max": 20
                },
                "common": {
                    "min": 20,
                    "max": 30
                },
                "strong": {
                    "min": 30,
                    "max": 40
                },
                "heavy": 40,
                "note": "1 standard drink ≈ 10 g ethanol (EU/WHO convention; a US 'standard drink' is ~14 g).",
                "source": "https://psychonautwiki.org/wiki/Alcohol"
            }
        },
        "routes": [
            {
                "name": "Oral",
                "displayName": "Drinking",
                "emoji": "🍺",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.25,
                        "max": 0.5,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.25,
                        "max": 0.5,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 0.5,
                        "max": 1.5,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 0.75,
                        "max": 2,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 6,
                        "max": 48,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 4,
            "cardiotoxicity": 3,
            "dehydration": 8,
            "sleep_deprivation": 7,
            "impulsivity": 6,
            "lethality": 6
        },
        "sleep_strategy": "Expect fragmented sleep. Hydrate before bed.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Meal: Eat a substantial meal with fat and protein before drinking.",
                        "detail": "Alcohol absorption depends heavily on stomach contents. Drinking on an empty stomach causes rapid absorption through the gastric mucosa, producing a dangerous blood alcohol spike. Fats and proteins delay gastric emptying, forcing slower absorption.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Alcohol",
                                "url": "https://psychonautwiki.org/wiki/Alcohol"
                            },
                            {
                                "label": "SaferParty — Alkohol",
                                "url": "https://www.saferparty.ch/substanzen/alkohol"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Hydration: Pre-hydrate to offset diuretic effects.",
                        "detail": "Alcohol inhibits ADH (antidiuretic hormone), causing continuous water loss through the kidneys. Starting well-hydrated provides a buffer against the inevitable fluid loss."
                    }
                ]
            },
            "during": {
                "focus": "Counteracting fluid loss from diuresis.",
                "essential": [
                    {
                        "short": "Hydration: Alternating each alcoholic drink with water or an electrolyte drink helps offset dehydration.",
                        "detail": "Alcohol suppresses ADH secretion, causing the kidneys to flush water continuously. Combined with sweating, this creates rapid two-front fluid loss. Roughly one water per drink is an easy way to limit it.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Alcohol",
                                "url": "https://psychonautwiki.org/wiki/Alcohol"
                            },
                            {
                                "label": "SaferParty — Alkohol",
                                "url": "https://www.saferparty.ch/substanzen/alkohol"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Do not mix with other depressants (ketamine, GHB, benzodiazepines).",
                        "detail": "Combining CNS depressants amplifies respiratory depression, causes profound motor control loss, and severely increases the risk of unconsciousness. If vomiting occurs while unconscious, the suppressed gag reflex makes aspiration likely.",
                        "sources": [
                            {
                                "label": "TripSit — Alcohol",
                                "url": "https://drugs.tripsit.me/alcohol"
                            },
                            {
                                "label": "PsychonautWiki — Alcohol",
                                "url": "https://psychonautwiki.org/wiki/Alcohol"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Note: Alcohol suppresses ADH, causing significant fluid loss.",
                        "detail": "Without ADH, the kidneys cannot reabsorb water. Every alcoholic drink accelerates dehydration. Relying on beer or cocktails for hydration worsens fatigue and hangover symptoms."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Hydration: 500 ml water + electrolytes before bed.",
                        "detail": "Replacing the electrolyte deficit (sodium and potassium) is the most effective method for preventing severe headaches and muscle spasms. An electrolyte supplement is far more effective than plain water."
                    },
                    {
                        "short": "Position: Sleep on your side if intoxicated.",
                        "detail": "The lateral recovery position ensures airway patency. If vomiting occurs during sleep, gravity prevents aspiration into the lungs — a potentially fatal event."
                    }
                ],
                "bonus": [
                    {
                        "short": "Food: Skip pre-bed food if nauseous.",
                        "detail": "If highly intoxicated, the risk of nocturnal vomiting and aspiration outweighs the benefits of eating. Focus entirely on hydration and safe sleep position instead."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Recovery: Electrolytes and B-vitamins.",
                        "detail": "Alcohol depletes B-vitamins (especially B1/thiamine and B6), which are critical for nervous system function. Replenishing electrolytes and B-vitamins addresses the primary biochemical deficits causing hangover symptoms.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Alcohol",
                                "url": "https://psychonautwiki.org/wiki/Alcohol"
                            },
                            {
                                "label": "DanceSafe — Alcohol",
                                "url": "https://dancesafe.org/alcohol/"
                            }
                        ]
                    },
                    {
                        "short": "Food: Light, easily digestible foods (toast, eggs).",
                        "detail": "The gastric mucosa is irritated from alcohol exposure. Light foods provide necessary glucose and amino acids without further irritating the stomach lining."
                    }
                ],
                "bonus": [
                    {
                        "short": "Avoid: drinking more alcohol to offset a hangover only delays it.",
                        "detail": "Consuming more alcohol merely delays the hangover by re-introducing the depressant. It prolongs liver stress, deepens dehydration, and significantly worsens the eventual recovery."
                    }
                ]
            }
        },
        "risks": [
            "Severe dehydration from ADH suppression",
            "REM sleep suppression and fragmentation",
            "Behavioral disinhibition",
            "Liver stress and gastric irritation"
        ],
        "mcda": {
            "score": 72,
            "rank": 1,
            "of": 20
        },
        "visualizer_note": "Deceptively harmful: dehydration, disinhibition and genuine overdose risk (alcohol poisoning, aspiration) — the most harmful drug overall in expert rankings."
    },
    "cannabis": {
        "id": "cannabis",
        "name": "Cannabis",
        "type": "Depressant/Psychedelic",
        "emoji": "🌿",
        "color": "#22c55e",
        "duration": 4,
        "dosing": {
            "Smoked": {
                "unit": "mg THC",
                "threshold": 1,
                "light": {
                    "min": 2,
                    "max": 4
                },
                "common": {
                    "min": 4,
                    "max": 10
                },
                "strong": {
                    "min": 10,
                    "max": 25
                },
                "heavy": 25,
                "source": "https://psychonautwiki.org/wiki/Cannabis"
            },
            "Oral (Edible)": {
                "unit": "mg THC",
                "threshold": 1,
                "light": {
                    "min": 2.5,
                    "max": 5
                },
                "common": {
                    "min": 5,
                    "max": 15
                },
                "strong": {
                    "min": 15,
                    "max": 30
                },
                "heavy": 30,
                "source": "https://psychonautwiki.org/wiki/Cannabis"
            }
        },
        "routes": [
            {
                "name": "Smoked",
                "displayName": "Smoked",
                "emoji": "🚬",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0,
                        "max": 0.17,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.08,
                        "max": 0.17,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 0.25,
                        "max": 0.75,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 0.5,
                        "max": 1.5,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 0.75,
                        "max": 3,
                        "label": "After-effects"
                    }
                }
            },
            {
                "name": "Oral (Edible)",
                "displayName": "Edible",
                "emoji": "🍪",
                "phases": {
                    "onset": {
                        "min": 0.5,
                        "max": 1.5,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 1,
                        "max": 3,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 1,
                        "max": 3,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 6,
                        "max": 24,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 1,
            "cardiotoxicity": 2,
            "dehydration": 2,
            "sleep_deprivation": 3,
            "impulsivity": 3,
            "lethality": 1
        },
        "sleep_strategy": "May help sleep onset, but reduces REM quality.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Safety: Verify source — avoid synthetic cannabinoids.",
                        "detail": "The illicit cannabis market carries significant risk of adulteration with synthetic cannabinoids sprayed onto CBD flower. Synthetics are full CB1 agonists with unpredictable dose-response curves, frequently leading to severe intoxication, psychosis, and cardiovascular emergencies.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Cannabis",
                                "url": "https://psychonautwiki.org/wiki/Cannabis"
                            },
                            {
                                "label": "SaferParty — Cannabis",
                                "url": "https://www.saferparty.ch/substanzen/cannabis"
                            }
                        ]
                    },
                    {
                        "short": "Environment: Choose a comfortable, familiar setting.",
                        "detail": "Cannabis amplifies environmental stimuli. A safe, familiar setting with trusted people significantly reduces the probability of anxiety or paranoia episodes."
                    }
                ]
            },
            "during": {
                "focus": "Blood pressure management.",
                "essential": [
                    {
                        "short": "Faintness: Sit or lie down if dizzy, and stand up slowly.",
                        "detail": "Cannabis is a peripheral vasodilator — it widens blood vessels and raises heart rate. Combined with standing and sweating, this creates a risk of orthostatic hypotension (a sudden blood-pressure drop on standing), causing dizziness or fainting. If you feel light-headed, sit or lie down and rise slowly. A snack or juice helps general energy but does not itself fix the blood-pressure drop.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Cannabis",
                                "url": "https://psychonautwiki.org/wiki/Cannabis"
                            },
                            {
                                "label": "SaferParty — Cannabis",
                                "url": "https://www.saferparty.ch/substanzen/cannabis"
                            }
                        ]
                    },
                    {
                        "short": "Caution: Avoid mixing with tobacco or alcohol.",
                        "detail": "Cannabis + tobacco amplifies respiratory depression and nausea. Cannabis + alcohol compounds CNS depression and vasodilation, often causing severe vertigo and vomiting.",
                        "sources": [
                            {
                                "label": "SaferParty — Cannabis",
                                "url": "https://www.saferparty.ch/substanzen/cannabis"
                            },
                            {
                                "label": "TripSit — Cannabis",
                                "url": "https://drugs.tripsit.me/cannabis"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Hydration: Sip water regularly to manage dry mouth.",
                        "detail": "Cannabis reduces saliva production via CB1 receptors in the salivary glands. Steady water sipping alleviates discomfort and maintains baseline hydration."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Appetite stimulation: Avoid overeating processed food before bed.",
                        "detail": "Cannabis stimulates hypothalamic appetite pathways. However, binge-eating processed foods spikes insulin and core body temperature, actively preventing deep restorative sleep."
                    }
                ],
                "bonus": [
                    {
                        "short": "Food: A light protein and carbohydrate snack is sufficient.",
                        "detail": "A small portion of slow-digesting protein and complex carbohydrates satisfies appetite while supporting overnight recovery without disrupting sleep."
                    },
                    {
                        "short": "Relaxation: Gentle stretching may help relieve mild tension.",
                        "detail": "Cannabis can cause mild muscle tension. Gentle stretching combined with the substance's natural relaxant properties helps prepare the body for sleep."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Residual effects: Cannabis aftereffects are common. Hydrate and move.",
                        "detail": "Residual cannabinoids can produce morning fogginess and lethargy. Physical movement and water intake accelerate clearance and help restore alertness."
                    }
                ],
                "bonus": [
                    {
                        "short": "Cognition: Expect some reduced processing speed.",
                        "detail": "THC suppresses REM sleep, which is critical for memory consolidation. Reduced cognitive processing is normal; plan for a lighter workload."
                    }
                ]
            }
        },
        "risks": [
            "Orthostatic hypotension (faintness/dizziness)",
            "Anxiety or paranoia episodes",
            "Adulteration with synthetic cannabinoids"
        ],
        "mcda": {
            "score": 20,
            "rank": 8,
            "of": 20
        },
        "visualizer_note": "Low physiological harm with no fatal overdose from THC; main issues are faintness, anxiety and synthetic-cannabinoid adulteration."
    },
    "ketamine": {
        "id": "ketamine",
        "name": "Ketamine",
        "type": "Dissociative",
        "emoji": "🐴",
        "color": "#14b8a6",
        "duration": 1.5,
        "dosing": {
            "Insufflated": {
                "unit": "mg",
                "threshold": 5,
                "light": {
                    "min": 10,
                    "max": 30
                },
                "common": {
                    "min": 30,
                    "max": 75
                },
                "strong": {
                    "min": 75,
                    "max": 150
                },
                "heavy": 150,
                "source": "https://psychonautwiki.org/wiki/Ketamine"
            },
            "Oral": {
                "unit": "mg",
                "threshold": 50,
                "light": {
                    "min": 50,
                    "max": 100
                },
                "common": {
                    "min": 100,
                    "max": 300
                },
                "strong": {
                    "min": 300,
                    "max": 450
                },
                "heavy": 450,
                "note": "Low oral bioavailability (~17–20%). Much higher doses needed.",
                "source": "https://psychonautwiki.org/wiki/Ketamine"
            }
        },
        "routes": [
            {
                "name": "Insufflated",
                "displayName": "Snorted",
                "emoji": "👃",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.03,
                        "max": 0.08,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.08,
                        "max": 0.25,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 0.25,
                        "max": 0.75,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 4,
                        "max": 12,
                        "label": "After-effects"
                    }
                }
            },
            {
                "name": "Oral",
                "displayName": "Swallowed",
                "emoji": "💊",
                "phases": {
                    "onset": {
                        "min": 0.25,
                        "max": 0.33,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.25,
                        "max": 0.5,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 0.75,
                        "max": 1.5,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 1,
                        "max": 2,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 4,
                        "max": 8,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 3,
            "cardiotoxicity": 2,
            "dehydration": 2,
            "sleep_deprivation": 3,
            "impulsivity": 4,
            "lethality": 3
        },
        "sleep_strategy": "Wait for full offset. Do not mix with depressants.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Stomach: Best to avoid eating in the ~90 minutes before, since ketamine can cause nausea and vomiting.",
                        "detail": "Ketamine frequently induces nausea and vomiting. At dissociative doses, the gag reflex is severely suppressed. Vomiting while dissociated can lead to aspiration and asphyxiation.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Ketamine",
                                "url": "https://psychonautwiki.org/wiki/Ketamine"
                            },
                            {
                                "label": "SaferParty — Ketamin",
                                "url": "https://www.saferparty.ch/substanzen/ketamin"
                            }
                        ]
                    },
                    {
                        "short": "Safety: Test your substance.",
                        "detail": "Ketamine can be adulterated with research chemicals or other dissociatives with longer durations and different safety profiles. Reagent testing or drug-checking services help verify identity."
                    }
                ],
                "bonus": [
                    {
                        "short": "Preparation: Crush to fine powder to protect nasal tissue.",
                        "detail": "Crystalline shards are poorly absorbed and cause severe micro-abrasions, leading to chronic sinus irritation, nosebleeds, and bacterial infections."
                    }
                ]
            },
            "during": {
                "focus": "Physical safety and bladder care.",
                "essential": [
                    {
                        "short": "Hydration: Drink to thirst — no need to force fluids.",
                        "detail": "Drink to thirst rather than forcing fluids. Long-term ketamine use is toxic to the bladder lining (ketamine-induced cystitis), so bladder health matters — but, unlike MDMA, a single ketamine session carries no special water-intoxication risk. Simply drink normally, neither forcing nor heavily restricting fluids.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Ketamine",
                                "url": "https://psychonautwiki.org/wiki/Ketamine"
                            },
                            {
                                "label": "TripSit — Ketamine",
                                "url": "https://drugs.tripsit.me/ketamine"
                            }
                        ]
                    },
                    {
                        "short": "Movement: Pain signals are blocked — exercise extreme caution.",
                        "detail": "Ketamine's anesthetic properties block pain perception. Moving vigorously while anesthetized is dangerous — you cannot feel joint strain, muscle tears, or ligament damage until the substance wears off."
                    },
                    {
                        "short": "Balance: Sit down immediately if you feel unsteady.",
                        "detail": "Ketamine causes severe ataxia (loss of motor control) and spatial disorientation. Falls are the most common injury. If balance feels impaired, sit in a safe environment immediately."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Environment: Low sensory input (dark, quiet space).",
                        "detail": "Coming down from ketamine leaves the user deeply disoriented and vulnerable. A calm, sensory-reduced environment aids psychological reintegration and prevents anxiety."
                    },
                    {
                        "short": "Safety: Use the lateral recovery position if resting.",
                        "detail": "If a user is unresponsive or deeply sedated, the recovery position ensures airway patency. Monitor breathing and never leave an unconscious person on their back."
                    }
                ],
                "bonus": [
                    {
                        "short": "Supplements: Delay magnesium until the next day.",
                        "detail": "Ketamine is itself a potent NMDA antagonist and muscle relaxant. Taking magnesium (which also acts via NMDA antagonism) immediately after use is redundant and may increase morning lethargy."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Body: Check for bruises or injuries.",
                        "detail": "Due to ketamine's anesthetic properties, injuries sustained during use may go unnoticed. A thorough physical check the next morning can reveal strains, bruises, or injuries that need attention."
                    }
                ],
                "bonus": [
                    {
                        "short": "Rest: Allow a full recovery day. Avoid redosing.",
                        "detail": "Residual dissociation, cognitive impairment, and disorientation are common the day after. Ketamine's effects on memory consolidation and spatial perception can persist well past the active window."
                    }
                ]
            }
        },
        "risks": [
            "Bladder damage (ketamine cystitis)",
            "Aspiration from vomiting while dissociated",
            "Physical injury due to anesthesia",
            "Loss of motor control"
        ],
        "mcda": {
            "score": 15,
            "rank": 11,
            "of": 20
        },
        "visualizer_note": "Moderate — bladder damage with repeated use and injury/aspiration while dissociated; overdose risk climbs steeply if mixed with depressants."
    },
    "lsd": {
        "id": "lsd",
        "name": "LSD",
        "type": "Psychedelic",
        "emoji": "🌈",
        "color": "#06b6d4",
        "duration": 12,
        "dosing": {
            "Sublingual": {
                "unit": "µg",
                "threshold": 15,
                "light": {
                    "min": 25,
                    "max": 75
                },
                "common": {
                    "min": 75,
                    "max": 150
                },
                "strong": {
                    "min": 150,
                    "max": 300
                },
                "heavy": 300,
                "source": "https://psychonautwiki.org/wiki/LSD"
            }
        },
        "routes": [
            {
                "name": "Sublingual",
                "displayName": "Sublingual",
                "emoji": "👅",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.25,
                        "max": 0.5,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.75,
                        "max": 1.5,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 3,
                        "max": 5,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 3,
                        "max": 5,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 12,
                        "max": 48,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 0,
            "cardiotoxicity": 3,
            "dehydration": 4,
            "sleep_deprivation": 8,
            "impulsivity": 3,
            "lethality": 1
        },
        "sleep_strategy": "Plan for complete insomnia during effects. Do not fight it.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Test: Ehrlich reagent kit (rule out NBOMe). Additionally, DOx compounds (effects lasting up to 48 hours) are also substituted as LSD.",
                        "detail": "The illicit market frequently substitutes LSD with 25I-NBOMe or DOx compounds — substances that can cause fatal cardiovascular events, seizures, and severe vasoconstriction at sub-milligram doses. An Ehrlich reagent test turns purple for indole compounds (LSD). Real-world UK festival testing has repeatedly documented 25x-NBOMe pills sold as LSD (significant overdose risk), and DOx compounds with effects lasting up to 48 hours.",
                        "sources": [
                            {
                                "label": "DanceSafe — LSD",
                                "url": "https://dancesafe.org/lsd/"
                            },
                            {
                                "label": "PsychonautWiki — LSD",
                                "url": "https://psychonautwiki.org/wiki/LSD"
                            },
                            {
                                "label": "The Loop — Drug Alerts",
                                "url": "https://wearetheloop.org/drug-alerts"
                            }
                        ]
                    },
                    {
                        "short": "Set & Setting: Trusted company, safe location.",
                        "detail": "LSD profoundly alters sensory perception and cognition for 8–12 hours. The psychological outcome is heavily dependent on the user's mindset ('set') and physical environment ('setting')."
                    }
                ],
                "bonus": [
                    {
                        "short": "Nutrition: Eat a light, healthy meal beforehand.",
                        "detail": "LSD suppresses hunger signals for the entire duration. Eating a balanced meal before ensures the body has adequate fuel for 12+ hours of wakefulness."
                    }
                ]
            },
            "during": {
                "focus": "Psychological grounding and calorie intake.",
                "essential": [
                    {
                        "short": "Nutrition: Consume fruit or smoothies regularly — hunger signals are suppressed.",
                        "detail": "LSD induces intense sympathetic arousal that entirely suppresses hunger and thirst cues. Going 10–12 hours without eating risks sudden hypoglycemia."
                    },
                    {
                        "short": "Hydration: Set reminders to drink.",
                        "detail": "Sensory overload and cognitive distortion make it easy to forget basic needs. External reminders from friends or phone alarms ensure consistent hydration."
                    }
                ],
                "bonus": [
                    {
                        "short": "Mindset: Change music or lighting if anxious.",
                        "detail": "Anxiety during a psychedelic experience often stems from environmental factors. A simple change of scene — different music, moving outdoors, or adjusting lighting — can rapidly shift the psychological trajectory."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Mindset: Accept wakefulness. Do not try to force sleep.",
                        "detail": "LSD's binding to 5-HT2A receptors keeps the CNS highly stimulated long after subjective effects diminish. Attempting to force sleep is physiologically impossible and causes post-trip anxiety."
                    },
                    {
                        "short": "Food: Protein + carbohydrates to restore caloric deficit.",
                        "detail": "After 12+ hours of suppressed appetite, the body is in significant caloric deficit. A protein and carbohydrate meal provides essential amino acids for recovery."
                    }
                ],
                "bonus": [
                    {
                        "short": "Activity: Gentle stretching and calming music.",
                        "detail": "Physical tension from sympathetic arousal builds over the 12-hour duration. Gentle stretching releases this tension while calming music aids the transition."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Rest: Plan for a full recovery day.",
                        "detail": "A 12-hour psychedelic experience combined with sleep deprivation results in profound fatigue. Plan for a recovery day with minimal obligations."
                    }
                ],
                "bonus": [
                    {
                        "short": "Afterglow: Expect residual visual effects and altered cognition for up to 24 hours.",
                        "detail": "LSD's long-acting serotonergic effects can persist well beyond the subjective peak. Residual perceptual changes (mild HPPD-like effects), cognitive reorganisation, and mood fluctuations are common on the recovery day. Avoid demanding cognitive or social tasks."
                    }
                ]
            }
        },
        "risks": [
            "Psychological crisis (challenging trip)",
            "Peripheral vasoconstriction",
            "Complete insomnia (8–12 hours)",
            "Severe caloric deficit"
        ],
        "mcda": {
            "score": 7,
            "rank": 18,
            "of": 20
        },
        "visualizer_note": "Physiologically very safe (near-zero overdose risk); the danger is psychological, plus total insomnia during effects. NBOMe substitutes are the real lethal risk."
    },
    "mushrooms": {
        "id": "mushrooms",
        "name": "Mushrooms (Psilocybin)",
        "type": "Psychedelic",
        "emoji": "🍄",
        "color": "#8b5cf6",
        "duration": 6,
        "dosing": {
            "Oral": {
                "unit": "g dried (P. cubensis)",
                "threshold": 0.25,
                "light": {
                    "min": 0.5,
                    "max": 1
                },
                "common": {
                    "min": 1,
                    "max": 2.5
                },
                "strong": {
                    "min": 2.5,
                    "max": 5
                },
                "heavy": 5,
                "source": "https://psychonautwiki.org/wiki/Psilocybin_mushrooms"
            }
        },
        "routes": [
            {
                "name": "Oral",
                "displayName": "Eaten",
                "emoji": "🍄",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.33,
                        "max": 1,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.25,
                        "max": 0.5,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 1,
                        "max": 2,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 1,
                        "max": 2,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 4,
                        "max": 24,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 0,
            "cardiotoxicity": 2,
            "dehydration": 2,
            "sleep_deprivation": 4,
            "impulsivity": 2,
            "lethality": 1
        },
        "sleep_strategy": "Insomnia likely until effects subside. Rest in darkness.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Set & Setting: Critical for preventing challenging trips.",
                        "detail": "Psilocybin amplifies emotions and environmental stimuli. Ensure a positive mindset and a safe, comfortable environment. Have a trusted trip-sitter present if possible."
                    },
                    {
                        "short": "Dose: Start low (1–2 g dried) to gauge potency.",
                        "detail": "Potency varies significantly between species and batches. A standard dose is 1.5–2.5 g. Doses above 5 g strongly increase the risk of a psychological crisis and are best avoided in a recreational setting."
                    }
                ],
                "bonus": [
                    {
                        "short": "Stomach: Light meal or fasting to reduce nausea.",
                        "detail": "Nausea on the come-up is mainly serotonergic — psilocin stimulates serotonin receptors in the gut, driving queasiness — with the tough fungal fibre a possible secondary factor. An empty or light stomach reduces the volume that can come back up; ginger is a well-established antiemetic, and a tea or lemon-tek is often gentler than eating whole mushrooms.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Psilocybin",
                                "url": "https://psychonautwiki.org/wiki/Psilocybin_mushrooms"
                            }
                        ]
                    }
                ]
            },
            "during": {
                "focus": "Emotional grounding and nausea management.",
                "essential": [
                    {
                        "short": "Nausea: Breathe through the onset (20–60 minutes).",
                        "detail": "Nausea is common during the come-up phase. It typically passes once peak effects are established. Find a comfortable position and breathe deeply."
                    },
                    {
                        "short": "Mindset: Do not resist the experience.",
                        "detail": "Anxiety often arises from resisting the dissolution of ego or control. Surrendering to the flow of the experience, even if challenging, is the safest psychological strategy."
                    }
                ],
                "bonus": [
                    {
                        "short": "Hydration: Keep water nearby and sip occasionally.",
                        "detail": "While not a diuretic, psilocybin can make you forget to drink. Gentle reminders help maintain baseline hydration."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Environment: Low stimulation. Allow the experience to settle.",
                        "detail": "The afterglow period involves continued serotonergic activity and reduced cognitive filtering. A quiet environment with minimal demands — walking outside, calm music, light food — allows the body and mind to return to baseline without unnecessary stress."
                    }
                ],
                "bonus": [
                    {
                        "short": "Food: Fresh fruit and healthy snacks.",
                        "detail": "Appetite often returns as effects fade. Fresh, unprocessed foods often feel most palatable and nourishing."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Mood: Usually an elevated afterglow.",
                        "detail": "Psilocybin often leaves a lasting positive mood lift. Use this window to reinforce healthy habits."
                    }
                ],
                "bonus": [
                    {
                        "short": "Rest: Allow for a relaxed schedule.",
                        "detail": "Psychological processing is energy-intensive. No specific physical hangover, but the mind may be tired."
                    }
                ]
            }
        },
        "risks": [
            "Psychological distress (challenging trip)",
            "Nausea and vomiting",
            "Accidental poisoning (if foraging)",
            "Confusion and disorientation"
        ],
        "mcda": {
            "score": 6,
            "rank": 20,
            "of": 20
        },
        "visualizer_note": "Among the lowest-harm substances — no fatal overdose from psilocybin itself; the main risks are difficult trips and misidentified wild mushrooms."
    },
    "cocaine": {
        "id": "cocaine",
        "name": "Cocaine",
        "type": "Stimulant",
        "emoji": "❄️",
        "color": "#d97706",
        "duration": 1,
        "dosing": {
            "Insufflated": {
                "unit": "mg",
                "threshold": 5,
                "light": {
                    "min": 10,
                    "max": 30
                },
                "common": {
                    "min": 30,
                    "max": 60
                },
                "strong": {
                    "min": 60,
                    "max": 90
                },
                "heavy": 90,
                "source": "https://psychonautwiki.org/wiki/Cocaine"
            }
        },
        "routes": [
            {
                "name": "Insufflated",
                "displayName": "Snorted",
                "emoji": "👃",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.02,
                        "max": 0.17,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.08,
                        "max": 0.25,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 0.25,
                        "max": 0.5,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 0.17,
                        "max": 0.5,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 1,
                        "max": 4,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 5,
            "cardiotoxicity": 8,
            "dehydration": 4,
            "sleep_deprivation": 6,
            "impulsivity": 8,
            "lethality": 6
        },
        "sleep_strategy": "Stop use 3–4 hours before bed. Sleep is very difficult.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Test: Use a reagent kit; fentanyl strips are a sensible extra precaution.",
                        "detail": "In Europe, fentanyl contamination of cocaine is uncommon (unlike parts of North America) but has caused deaths, so fentanyl test strips are a cheap, worthwhile precaution — not a guarantee. More useful for identity and purity is a reagent kit (e.g. Marquis/Mecke/Morris) or a drug-checking service, which also flags the common cutting agents.",
                        "sources": [
                            {
                                "label": "DanceSafe — Cocaine",
                                "url": "https://dancesafe.org/cocaine/"
                            },
                            {
                                "label": "PsychonautWiki — Cocaine",
                                "url": "https://psychonautwiki.org/wiki/Cocaine"
                            },
                            {
                                "label": "Drugchecking Berlin — Cocaine/Crack",
                                "url": "https://drugchecking.berlin/substanzen/kokain-crack"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Levamisole: The most common dangerous cocaine adulterant.",
                        "detail": "A large share of street cocaine is cut with levamisole (a veterinary deworming agent). It can suppress the immune system (agranulocytosis) and cause skin necrosis and vasculitis. It cannot be seen or tasted; only lab-based drug checking detects it reliably. Unexplained sores, mouth ulcers, fever, or repeated infections after cocaine use warrant medical attention.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Cocaine",
                                "url": "https://psychonautwiki.org/wiki/Cocaine"
                            },
                            {
                                "label": "checkit! — Cocaine",
                                "url": "https://checkit.wien/substanz/kokain/"
                            },
                            {
                                "label": "Drugchecking Berlin — Cocaine/Crack",
                                "url": "https://drugchecking.berlin/substanzen/kokain-crack"
                            }
                        ]
                    },
                    {
                        "short": "Hygiene: Use your own straw. Never share (Hepatitis C risk).",
                        "detail": "Micro-abrasions in the nasal cavity can transmit blood-borne pathogens like Hepatitis C. Sharing straws or bills is a primary vector for transmission. Use a personal, clean tool."
                    }
                ],
                "bonus": [
                    {
                        "short": "Nasal care: Pre-moisturize with saline spray.",
                        "detail": "Dry nasal membranes rupture easily. Pre-moistening with saline spray reduces damage and aids absorption."
                    }
                ]
            },
            "during": {
                "focus": "Cardiac monitoring and impulse control.",
                "essential": [
                    {
                        "short": "⚠️ Alcohol danger: Cocaethylene formation is lethal.",
                        "detail": "Combining cocaine + alcohol forms cocaethylene in the liver. This metabolite is significantly more cardiotoxic than cocaine alone, exponentially increasing the risk of sudden cardiac death.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Cocaine",
                                "url": "https://psychonautwiki.org/wiki/Cocaine"
                            },
                            {
                                "label": "TripSit — Cocaine",
                                "url": "https://drugs.tripsit.me/cocaine"
                            },
                            {
                                "label": "SaferParty — Kokain",
                                "url": "https://www.saferparty.ch/substanzen/kokain"
                            }
                        ]
                    },
                    {
                        "short": "Heart: Vasoconstriction is severe. Monitor for chest tightness.",
                        "detail": "Cocaine constricts blood vessels while spiking heart rate — forcing the heart to pump against high pressure. Chest tightness is a warning sign to stop immediately."
                    }
                ],
                "bonus": [
                    {
                        "short": "Preparation: Fine powder absorbs better and reduces tissue damage.",
                        "detail": "Large crystals damage tissue and are poorly absorbed. Rinsing with saline between sessions helps limit tissue damage."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Comedown: Expect anxiety and cravings.",
                        "detail": "Cocaine has a sharp, unpleasant crash. Recognize the craving as a chemical signal, not a true need. Do not redose to delay the inevitable."
                    }
                ],
                "bonus": [
                    {
                        "short": "Nasal care: Thorough saline rinse.",
                        "detail": "Flushing the sinuses prevents residual caustic chemicals from damaging the septum overnight."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Recovery: Rest and hydration.",
                        "detail": "Dopamine receptors are temporarily downregulated. Expect low mood and irritability. Sleep and time are the primary recovery mechanisms."
                    }
                ],
                "bonus": [
                    {
                        "short": "Nasal check: Inspect for bleeding or scabs.",
                        "detail": "Apply vitamin E oil to soothe tissue. Persistent bleeding or crusting may indicate significant septum damage."
                    }
                ]
            }
        },
        "risks": [
            "Severe cardiotoxicity (heart attack)",
            "Cocaethylene formation (with alcohol)",
            "Adulteration (commonly levamisole; occasionally fentanyl)",
            "Compulsive redosing"
        ],
        "mcda": {
            "score": 27,
            "rank": 5,
            "of": 20
        },
        "visualizer_note": "High cardiotoxicity and strong compulsion; overdose risk is real and rises sharply with binge use or alcohol (cocaethylene)."
    },
    "amphetamine": {
        "id": "amphetamine",
        "name": "Amphetamine",
        "type": "Stimulant",
        "emoji": "⚡",
        "color": "#f97316",
        "duration": 6,
        "dosing": {
            "Oral": {
                "unit": "mg",
                "threshold": 3,
                "light": {
                    "min": 5,
                    "max": 15
                },
                "common": {
                    "min": 15,
                    "max": 30
                },
                "strong": {
                    "min": 30,
                    "max": 50
                },
                "heavy": 50,
                "note": "Street 'speed' purity varies widely — use drug-checking services. SaferParty advises a ceiling of ~50 mg per 12 hours. Wet amphetamine paste must be fully dried before dosing (residual solvents are toxic).",
                "source": "https://psychonautwiki.org/wiki/Amphetamine"
            },
            "Insufflated": {
                "unit": "mg",
                "threshold": 2,
                "light": {
                    "min": 3,
                    "max": 10
                },
                "common": {
                    "min": 10,
                    "max": 25
                },
                "strong": {
                    "min": 25,
                    "max": 40
                },
                "heavy": 40,
                "source": "https://psychonautwiki.org/wiki/Amphetamine"
            }
        },
        "routes": [
            {
                "name": "Oral",
                "displayName": "Swallowed",
                "emoji": "💊",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.25,
                        "max": 0.5,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 2.5,
                        "max": 4,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 2,
                        "max": 3,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 6,
                        "max": 24,
                        "label": "After-effects"
                    }
                }
            },
            {
                "name": "Insufflated",
                "displayName": "Snorted",
                "emoji": "👃",
                "phases": {
                    "onset": {
                        "min": 0.03,
                        "max": 0.17,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.08,
                        "max": 0.25,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 2,
                        "max": 4,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 1,
                        "max": 2,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 2,
                        "max": 12,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 5,
            "cardiotoxicity": 7,
            "dehydration": 6,
            "sleep_deprivation": 8,
            "impulsivity": 6,
            "lethality": 5
        },
        "sleep_strategy": "Sleep is very difficult until the drug clears. Do not redose to delay it; plan recovery time.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Meal: Large, nutritionally dense meal before — appetite will be fully suppressed.",
                        "detail": "Amphetamines suppress appetite entirely and make swallowing difficult. A nutritionally dense meal rich in complex carbohydrates and protein is the only way to ensure adequate energy for hours of stimulated activity."
                    }
                ],
                "bonus": [
                    {
                        "short": "Supplements (optional): some people pre-load magnesium for vasoconstriction and muscle tension.",
                        "detail": "Amphetamines cause severe vasoconstriction and muscle tension. Pre-loading magnesium provides a buffer against these effects and supports cardiovascular function."
                    }
                ]
            },
            "during": {
                "focus": "Cardiac safety and core temperature management.",
                "essential": [
                    {
                        "short": "Rest: Take regular breaks (roughly hourly is a good target) to let heart rate and temperature settle.",
                        "detail": "Amphetamines place intense continuous strain on the cardiovascular system — elevated heart rate, blood pressure, and core temperature. The dopamine flood masks pain and fatigue perception.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Amphetamine",
                                "url": "https://psychonautwiki.org/wiki/Amphetamine"
                            },
                            {
                                "label": "SaferParty — Amphetamin",
                                "url": "https://www.saferparty.ch/substanzen/amphetamin"
                            }
                        ]
                    },
                    {
                        "short": "Pain and fatigue are masked — pace yourself and try not to push through strain or injury.",
                        "detail": "The dopamine flood completely blocks pain and fatigue perception. Users can sustain joint damage, muscle tears, or exertional heatstroke without any subjective warning signs.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — Amphetamine",
                                "url": "https://psychonautwiki.org/wiki/Amphetamine"
                            },
                            {
                                "label": "SaferParty — Amphetamin",
                                "url": "https://www.saferparty.ch/substanzen/amphetamin"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Never combine with MAOIs or serotonergic antidepressants.",
                        "detail": "Amphetamine with an MAOI (including moclobemide, or the herb Syrian rue) can cause a hypertensive crisis and serotonin syndrome — potentially fatal. Combined with SSRIs/SNRIs the risk of serotonin toxicity also rises. If you take any antidepressant or MAOI, do not use amphetamine without medical advice.",
                        "sources": [
                            {
                                "label": "Drugchecking Berlin — Amphetamine/Speed",
                                "url": "https://drugchecking.berlin/substanzen/amphetamin-speed"
                            },
                            {
                                "label": "checkit! — Speed/Amphetamine",
                                "url": "https://checkit.wien/substanz/speed-amphetamin/"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Nutrition: Consume liquid calories (shakes, gels) despite zero appetite.",
                        "detail": "Solid food is unpalatable on amphetamines. Protein shakes, carbohydrate gels, or smoothies provide circulating glucose and prevent muscle catabolism."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Food: Try to eat despite low appetite.",
                        "detail": "Despite zero appetite, the body is in severe caloric deficit after hours of stimulated activity without food. Even small portions of protein and carbohydrates prevent continued muscle catabolism."
                    }
                ],
                "bonus": [
                    {
                        "short": "Supplements (optional): vitamin C for general recovery — not to \"flush out\" the drug.",
                        "detail": "Gram-level vitamin C does not meaningfully acidify urine — that would need very high doses (~12 g/day, with their own risks) — so it does not accelerate amphetamine clearance or shorten the comedown, contrary to a common claim. It remains useful for general antioxidant and nutrient replenishment after a depleting night.",
                        "sources": [
                            {
                                "label": "SaferParty — Amphetamin",
                                "url": "https://www.saferparty.ch/substanzen/amphetamin"
                            }
                        ]
                    },
                    {
                        "short": "Supplements (optional): magnesium for muscle tightness.",
                        "detail": "Amphetamine-induced vasoconstriction causes severe muscle cramping and tension. Magnesium directly counteracts this by promoting smooth muscle relaxation."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Mood: Expect lethargy and low mood (dopamine depletion).",
                        "detail": "Amphetamines deplete dopamine stores, resulting in intense lethargy, inability to feel pleasure (anhedonia), and emotional instability. This is a temporary neurochemical deficit."
                    }
                ],
                "bonus": [
                    {
                        "short": "Recovery (optional): some people take L-Tyrosine the next day (a dopamine precursor; evidence is limited).",
                        "detail": "L-Tyrosine is the amino acid precursor to dopamine. Supplementing the next day provides building blocks for faster dopamine store replenishment."
                    }
                ]
            }
        },
        "risks": [
            "Severe cardiovascular strain (blood pressure/heart rate)",
            "Hyperthermia (masked overheating)",
            "Exhaustion and physical injury",
            "Stimulant psychosis (with sleep deprivation)"
        ],
        "mcda": {
            "score": 23,
            "rank": 7,
            "of": 20
        },
        "visualizer_note": "Sustained cardiovascular strain, hyperthermia and heavy sleep loss; overdose is less abrupt than opioids but real at high doses."
    },
    "mdma": {
        "id": "mdma",
        "name": "MDMA",
        "type": "Empathogen",
        "emoji": "💖",
        "color": "#ec4899",
        "duration": 4.5,
        "dosing": {
            "Oral": {
                "unit": "mg",
                "threshold": 30,
                "light": {
                    "min": 40,
                    "max": 75
                },
                "common": {
                    "min": 75,
                    "max": 140
                },
                "strong": {
                    "min": 140,
                    "max": 180
                },
                "heavy": 180,
                "note": "Max: 1.5 mg/kg (men), 1.3 mg/kg (women). Effects plateau at ~125–150 mg; higher doses increase toxicity, not euphoria.",
                "source": "https://psychonautwiki.org/wiki/MDMA"
            },
            "Insufflated": {
                "unit": "mg",
                "threshold": 15,
                "light": {
                    "min": 20,
                    "max": 37
                },
                "common": {
                    "min": 37,
                    "max": 70
                },
                "strong": {
                    "min": 70,
                    "max": 90
                },
                "heavy": 90,
                "note": "Dose at approximately half the oral amount. Described as very unpleasant and causes nasal tissue irritation. Not recommended.",
                "source": "https://www.saferparty.ch/substanzen/mdma"
            }
        },
        "routes": [
            {
                "name": "Oral",
                "displayName": "Swallowed",
                "emoji": "💊",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.25,
                        "max": 0.5,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 1.5,
                        "max": 2.5,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 1,
                        "max": 1.5,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 12,
                        "max": 48,
                        "label": "After-effects"
                    }
                }
            },
            {
                "name": "Insufflated",
                "displayName": "Snorted",
                "emoji": "👃",
                "phases": {
                    "onset": {
                        "min": 0.05,
                        "max": 0.15,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.15,
                        "max": 0.33,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 1,
                        "max": 2,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 0.75,
                        "max": 1.25,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 12,
                        "max": 48,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 7,
            "cardiotoxicity": 6,
            "dehydration": 7,
            "sleep_deprivation": 6,
            "impulsivity": 5,
            "lethality": 5
        },
        "sleep_strategy": "Usually possible 6+ hours after last dose. Melatonin helps.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Dose: Around 1.5 mg/kg is a common guideline, and staying under ~150 mg keeps toxicity lower — higher doses add side-effects, not much extra euphoria.",
                        "detail": "The neurobehavioral effect plateaus around 125–150 mg. Exceeding this does not increase empathy or euphoria, but does increase amphetamine-like stimulation, jaw clenching (bruxism), and neurotoxicity.",
                        "sources": [
                            {
                                "label": "DanceSafe — MDMA",
                                "url": "https://dancesafe.org/mdma/"
                            },
                            {
                                "label": "SaferParty — MDMA",
                                "url": "https://www.saferparty.ch/substanzen/mdma"
                            },
                            {
                                "label": "PsychonautWiki — MDMA",
                                "url": "https://psychonautwiki.org/wiki/MDMA"
                            },
                            {
                                "label": "checkit! Wien — Ecstasy/MDMA",
                                "url": "https://checkit.wien/substanz/ecstasy-mdma/"
                            },
                            {
                                "label": "Jellinek — XTC/MDMA",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/xtc-mdma/"
                            },
                            {
                                "label": "Energy Control — MDMA",
                                "url": "https://energycontrol.org/sustancias/mdma/"
                            },
                            {
                                "label": "Drugchecking Berlin — MDMA/Ecstasy",
                                "url": "https://drugchecking.berlin/substanzen/mdma-ecstasy"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ CRITICAL: Pill identity & content are extremely unreliable. Samples sold as 'MDMA' may be caffeine, other stimulants, or contain no MDMA at all (at one 2021 UK festival, ~30% of 'MDMA' samples were caffeine). High-dose pills (250–300+ mg) circulate widely. Always test before consuming.",
                        "detail": "Identical-looking pills can contain completely different drugs — one batch might be genuine MDMA, the next batch with the same logo might be caffeine, synthetic cathinones (4-CMC), NBOMe compounds, PMA/PMMA, or even nitazenes (synthetic opioids linked to deaths). Additionally, many modern pills exceed 200 mg — far above the safe 150 mg threshold. Visual appearance and branding are NOT reliable. Drug testing (reagent kits or coulter testing services) is essential.",
                        "sources": [
                            {
                                "label": "The Loop — Drug Alerts",
                                "url": "https://wearetheloop.org/drug-alerts"
                            },
                            {
                                "label": "Drugchecking Berlin — Alerts",
                                "url": "https://drugchecking.berlin/aktuelle-warnungen"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Supplements: ALA/ALCAR are sometimes taken as antioxidants — evidence is weak.",
                        "detail": "The rationale is that antioxidants like Alpha-Lipoic Acid (ALA) and Acetyl-L-Carnitine (ALCAR) buffer the oxidative stress from MDMA metabolism. This neuroprotection is demonstrated only in animal studies and is unproven in humans — it does not replace the measures that actually reduce harm: limiting dose, staying cool, and spacing use 4–6 weeks apart.",
                        "sources": [
                            {
                                "label": "DanceSafe — MDMA",
                                "url": "https://dancesafe.org/mdma/"
                            },
                            {
                                "label": "RollSafe — Health & safety",
                                "url": "https://rollsafe.org/"
                            }
                        ]
                    }
                ]
            },
            "during": {
                "focus": "Regulating core temperature and water intake.",
                "essential": [
                    {
                        "short": "Hydration limit: 250 ml (1 cup) per hour if resting, 500 ml if active. Electrolyte drinks only (not plain water).",
                        "detail": "MDMA promotes the release of antidiuretic hormone (ADH), completely halting urination. Drinking excess water dilutes blood sodium rapidly, leading to MDMA-associated hyponatremia. This condition causes brain swelling and can be fatal; reported fatal cases have disproportionately involved women, who appear more susceptible. Use electrolyte-containing sports drinks, not plain water alone.",
                        "sources": [
                            {
                                "label": "TripSit — MDMA",
                                "url": "https://drugs.tripsit.me/mdma"
                            },
                            {
                                "label": "DanceSafe — MDMA",
                                "url": "https://dancesafe.org/mdma/"
                            },
                            {
                                "label": "PsychonautWiki — MDMA",
                                "url": "https://psychonautwiki.org/wiki/MDMA"
                            },
                            {
                                "label": "Energy Control — MDMA",
                                "url": "https://energycontrol.org/sustancias/mdma/"
                            },
                            {
                                "label": "checkit! Wien — Ecstasy/MDMA",
                                "url": "https://checkit.wien/substanz/ecstasy-mdma/"
                            },
                            {
                                "label": "Drugchecking Berlin — MDMA/Ecstasy",
                                "url": "https://drugchecking.berlin/substanzen/mdma-ecstasy"
                            }
                        ]
                    },
                    {
                        "short": "Heat: Take regular cooling breaks and step out of the heat whenever you feel too warm.",
                        "detail": "MDMA impairs the body's thermoregulatory center. When combined with crowded spaces and dancing, core body temperatures can reach dangerous levels (hyperthermia), which simultaneously multiplies neurotoxicity.",
                        "sources": [
                            {
                                "label": "checkit! Wien — Ecstasy/MDMA",
                                "url": "https://checkit.wien/substanz/ecstasy-mdma/"
                            },
                            {
                                "label": "Energy Control — MDMA",
                                "url": "https://energycontrol.org/sustancias/mdma/"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Supplements (optional): some people take vitamin C and magnesium during the roll.",
                        "detail": "Vitamin C provides ongoing antioxidant support. Magnesium helps prevent severe jaw clenching and muscle tension."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "⚠️ Danger: Do NOT take 5-HTP within 24 hours of MDMA.",
                        "detail": "Taking 5-HTP while MDMA is still active in the central nervous system creates a severe risk of Serotonin Syndrome — an acute, life-threatening condition caused by excess serotonin. DanceSafe advises waiting at least 8 hours; we advise 24 hours to be safe. The brain requires up to 4 weeks to fully rebuild normal serotonin levels.",
                        "sources": [
                            {
                                "label": "checkit! Wien — Ecstasy/MDMA",
                                "url": "https://checkit.wien/substanz/ecstasy-mdma/"
                            },
                            {
                                "label": "DanceSafe — MDMA",
                                "url": "https://dancesafe.org/mdma/"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Supplements (optional): magnesium to ease jaw tension.",
                        "detail": "A final dose of high-absorption magnesium (glycinate) facilitates muscle relaxation to assist with sleep onset."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Mood: Be prepared for a mood dip (typically peaks 2–3 days after use — the 'Tuesday Dip').",
                        "detail": "Significant serotonin depletion occurs. The lowest mood point rarely hits the next day, but rather 48–72 hours later. Recognize this as a temporary neurochemical deficit, not a permanent psychological state. This is characterized by sadness, irritability, and insomnia.",
                        "sources": [
                            {
                                "label": "Energy Control — MDMA",
                                "url": "https://energycontrol.org/sustancias/mdma/"
                            },
                            {
                                "label": "Jellinek — XTC/MDMA",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/xtc-mdma/"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Recovery (optional): some people take 5-HTP with green tea extract (EGCG) after 24 h to support serotonin recovery.",
                        "detail": "After 24 hours, taking 5-HTP with EGCG (which ensures conversion happens in the brain, not the gut) accelerates the regeneration of depleted serotonin stores."
                    },
                    {
                        "short": "Nutrition: High-tryptophan foods.",
                        "detail": "Eggs, salmon, and turkey provide the amino acid building blocks for serotonin synthesis."
                    }
                ]
            }
        },
        "risks": [
            "Hyponatremia (water intoxication from ADH release)",
            "Hyperthermia (overheating)",
            "Serotonin syndrome (if interacting with antidepressants MAOI/SSRI)",
            "Severe serotonin depletion (neurochemical crash)"
        ],
        "mcda": {
            "score": 9,
            "rank": 16,
            "of": 20
        },
        "visualizer_note": "Neurotoxic and dehydrating; the main killers are hyperthermia and water intoxication (hyponatremia), not a simple 'overdose'."
    },
    "caffeine": {
        "id": "caffeine",
        "name": "Caffeine",
        "type": "Stimulant",
        "emoji": "☕",
        "color": "#ca8a04",
        "duration": 5,
        "dosing": {
            "Oral": {
                "unit": "mg",
                "threshold": 10,
                "light": {
                    "min": 20,
                    "max": 100
                },
                "common": {
                    "min": 100,
                    "max": 300
                },
                "strong": {
                    "min": 300,
                    "max": 500
                },
                "heavy": 500,
                "note": "1 cup coffee ≈ 90–200 mg. Max recommended: 400 mg/day.",
                "source": "https://psychonautwiki.org/wiki/Caffeine"
            }
        },
        "routes": [
            {
                "name": "Oral",
                "displayName": "Drinking",
                "emoji": "☕",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.08,
                        "max": 0.17,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.25,
                        "max": 0.5,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 1,
                        "max": 2,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 1,
                        "max": 2,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 2,
                        "max": 6,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 0,
            "cardiotoxicity": 2,
            "dehydration": 3,
            "sleep_deprivation": 6,
            "impulsivity": 1,
            "lethality": 1
        },
        "sleep_strategy": "Avoid caffeine less than 6 hours before planned sleep.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Timing: Stop intake 6–8 hours before planned sleep.",
                        "detail": "Caffeine has a half-life of 5–7 hours in healthy adults. Consuming 200 mg+ late ensures active concentrations well past dawn, entirely preventing slow-wave sleep required for muscle repair."
                    }
                ],
                "bonus": [
                    {
                        "short": "Hydration: Offset the diuretic effect.",
                        "detail": "Caffeine acts as both a mild diuretic and a peripheral vasoconstrictor. Consistent water intake alongside caffeine prevents compounding dehydration from physical activity."
                    }
                ]
            },
            "during": {
                "focus": "Timing and moderation.",
                "essential": [
                    {
                        "short": "Limit: Under 400 mg total (approximately 4 cups).",
                        "detail": "Above 400 mg/day, caffeine significantly increases the risk of anxiety, tremors, and gastrointestinal distress. Individual tolerance varies, but ~400 mg/day for healthy adults is the limit set by food-safety authorities (EFSA, US FDA).",
                        "sources": [
                            {
                                "label": "EFSA — Caffeine safety (2015)",
                                "url": "https://www.efsa.europa.eu/en/topics/topic/caffeine"
                            },
                            {
                                "label": "US FDA — Spilling the Beans on Caffeine",
                                "url": "https://www.fda.gov/consumers/consumer-updates/spilling-beans-how-much-caffeine-too-much"
                            },
                            {
                                "label": "PsychonautWiki — Caffeine",
                                "url": "https://psychonautwiki.org/wiki/Caffeine"
                            }
                        ]
                    },
                    {
                        "short": "Avoid mixing with other stimulants (added cardiac strain).",
                        "detail": "Caffeine alongside MDMA, amphetamines, or cocaine adds cardiovascular load — raising heart rate and blood pressure — and can heighten anxiety and physical discomfort. The extra caffeine is generally unnecessary next to a stimulant and offers little benefit. TripSit classifies these pairings as 'Caution' rather than dangerous.",
                        "sources": [
                            {
                                "label": "SaferParty — Koffein",
                                "url": "https://www.saferparty.ch/substanzen/koffein"
                            },
                            {
                                "label": "TripSit — Caffeine",
                                "url": "https://drugs.tripsit.me/caffeine"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Hydration: Water with every caffeinated drink.",
                        "detail": "The diuretic effect of caffeine combined with sweat loss accelerates dehydration. Matching each caffeinated beverage with water maintains fluid balance."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Sleep: If taken late, accept reduced sleep quality.",
                        "detail": "Caffeine blocks adenosine receptors — the neurochemical signals that inform the brain of fatigue. If caffeine is still active at bedtime, slow-wave sleep will be severely impaired."
                    }
                ],
                "bonus": [
                    {
                        "short": "Supplements: L-Theanine can smooth out jitters.",
                        "detail": "L-Theanine promotes alpha brain wave activity and has a synergistic calming effect when combined with caffeine, reducing anxiety without blocking alertness."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Hydration: Water first, then coffee.",
                        "detail": "After sleep-deprived nights, the body wakes in a state of mild dehydration. Water and a balanced breakfast resolve the underlying physiological deficit that caffeine merely masks."
                    }
                ],
                "bonus": [
                    {
                        "short": "Timing: Wait 90 minutes before first coffee (cortisol reset).",
                        "detail": "The cortisol awakening response naturally peaks 30–90 minutes after waking. Consuming caffeine during this window interferes with the natural energy signal and creates dependency."
                    }
                ]
            }
        },
        "risks": [
            "Insomnia from delayed clearance",
            "Anxiety and jitters",
            "Dehydration (diuretic effect)"
        ],
        "mcda": null,
        "visualizer_note": "Low overall harm; mainly disrupts sleep with mild cardiac strain. Fatal overdose needs extreme doses (grams)."
    },
    "2cb": {
        "id": "2cb",
        "name": "2C-B",
        "type": "Psychedelic",
        "emoji": "🔮",
        "color": "#a855f7",
        "duration": 6,
        "dosing": {
            "Oral": {
                "unit": "mg",
                "threshold": 2,
                "light": {
                    "min": 5,
                    "max": 15
                },
                "common": {
                    "min": 15,
                    "max": 25
                },
                "strong": {
                    "min": 25,
                    "max": 35
                },
                "heavy": 35,
                "note": "Extremely steep dose-response curve. Use a milligram scale. Never estimate by eye.",
                "source": "https://psychonautwiki.org/wiki/2C-B"
            },
            "Insufflated": {
                "unit": "mg",
                "threshold": 1,
                "light": {
                    "min": 2,
                    "max": 5
                },
                "common": {
                    "min": 5,
                    "max": 10
                },
                "strong": {
                    "min": 10,
                    "max": 15
                },
                "heavy": 15,
                "note": "Extremely painful to insufflate. Not recommended.",
                "source": "https://psychonautwiki.org/wiki/2C-B"
            }
        },
        "routes": [
            {
                "name": "Oral",
                "displayName": "Swallowed",
                "emoji": "💊",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.33,
                        "max": 1,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.25,
                        "max": 0.5,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 1.5,
                        "max": 2.5,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 1,
                        "max": 2,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 2,
                        "max": 4,
                        "label": "After-effects"
                    }
                }
            },
            {
                "name": "Insufflated",
                "displayName": "Snorted",
                "emoji": "👃",
                "phases": {
                    "onset": {
                        "min": 0.02,
                        "max": 0.08,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.08,
                        "max": 0.25,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 2,
                        "max": 4,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 1,
            "cardiotoxicity": 3,
            "dehydration": 3,
            "sleep_deprivation": 4,
            "impulsivity": 2,
            "lethality": 2
        },
        "sleep_strategy": "Shorter than LSD. Standard recovery protocol sufficient.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Dose: Use a milligram scale. A 2 mg difference is significant.",
                        "detail": "2C-B has an exceptionally steep dose-response curve. Around 5–15 mg it is largely entactogenic; above ~15 mg the psychedelic effects come forward, and by ~20 mg+ they can be overwhelming. A 2–3 mg difference can shift a manageable state into a crisis. Never estimate by sight — the most accurate method is volumetric dosing (dissolving a precisely weighed amount in a known volume of liquid).",
                        "sources": [
                            {
                                "label": "PsychonautWiki — 2C-B",
                                "url": "https://psychonautwiki.org/wiki/2C-B"
                            },
                            {
                                "label": "DanceSafe — 2C-B",
                                "url": "https://dancesafe.org/2c-b/"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Test it: \"pink cocaine\" / Tusi is usually NOT 2C-B.",
                        "detail": "Powders and pills sold as 2C-B are frequently something else. \"Tusi\" / \"tuci\" / \"pink cocaine\" in particular rarely contains 2C-B — it is typically a ketamine + MDMA (± caffeine) mixture, and drug-checking services have found 2C-B tablets cut with the precursor 2C-H. Use a reagent test or a drug-checking service before dosing.",
                        "sources": [
                            {
                                "label": "DanceSafe — 2C-B",
                                "url": "https://dancesafe.org/2c-b/"
                            },
                            {
                                "label": "Drugchecking Berlin — Alerts",
                                "url": "https://drugchecking.berlin/aktuelle-warnungen"
                            }
                        ]
                    },
                    {
                        "short": "Stomach: Empty stomach reduces nausea.",
                        "detail": "2C-B is known for intense gastrointestinal distress during onset. An empty stomach minimizes nausea and reduces the likelihood of vomiting during the come-up phase."
                    }
                ],
                "bonus": [
                    {
                        "short": "Supplements (optional): ginger (250–500 mg) can help with nausea.",
                        "detail": "Ginger taken 30 minutes before significantly reduces nausea by acting on serotonin receptors in the GI tract — the same mechanism targeted by pharmaceutical antiemetics."
                    }
                ]
            },
            "during": {
                "focus": "Nausea management during onset.",
                "essential": [
                    {
                        "short": "Onset: Avoid food or heavy liquids for 60–90 minutes.",
                        "detail": "The onset phase produces intense stomach cramping and nausea. Consuming any solid food or heavy liquids during this window dramatically increases the probability of vomiting."
                    },
                    {
                        "short": "Hydration: Standard electrolyte protocol after nausea passes.",
                        "detail": "Once peak effects are established and nausea subsides, revert to the baseline hydration protocol — water supplemented with electrolytes at a comfortable pace."
                    }
                ],
                "bonus": [
                    {
                        "short": "Note: Visuals can be intense while headspace stays relatively clear.",
                        "detail": "Unlike LSD or psilocybin, 2C-B typically produces vivid visual effects while maintaining a relatively lucid mental state. Understanding this pattern helps prevent anxiety."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Recovery: a normal meal — some people add magnesium.",
                        "detail": "2C-B mimics serotonin at the receptor site rather than forcing massive endogenous release (like MDMA). The neurological comedown is significantly milder."
                    }
                ],
                "bonus": [
                    {
                        "short": "Note: No 5-HTP needed (no serotonin depletion).",
                        "detail": "Unlike MDMA, 2C-B does not deplete serotonin stores. The aggressive supplementation protocol for MDMA comedowns is unnecessary for 2C-B recovery."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Mood: Usually a mild positive afterglow.",
                        "detail": "Most users report a gentle, positive mood the day after 2C-B — in contrast to MDMA or amphetamine depletion effects."
                    }
                ],
                "bonus": [
                    {
                        "short": "Routine: Standard recovery — hydrate, eat, get sunlight.",
                        "detail": "No special supplements or interventions are needed. Follow the sober baseline: hydrate, eat a balanced breakfast, and get sunlight exposure."
                    }
                ]
            }
        },
        "risks": [
            "Nausea and vomiting during onset",
            "Dosing errors (steep dose-response curve)",
            "Frequently mis-sold ('pink cocaine' is rarely 2C-B)",
            "Intense visual overwhelm at higher doses"
        ],
        "mcda": null,
        "visualizer_note": "Generally low harm at correct doses, but a steep dose-response and frequent mis-selling ('pink cocaine') drive the risk."
    },
    "4mmc": {
        "id": "4mmc",
        "name": "4-MMC (Mephedrone)",
        "type": "Stimulant/Empathogen",
        "emoji": "💥",
        "color": "#d946ef",
        "duration": 1,
        "dosing": {
            "Insufflated": {
                "unit": "mg",
                "threshold": 5,
                "light": {
                    "min": 15,
                    "max": 45
                },
                "common": {
                    "min": 45,
                    "max": 80
                },
                "strong": {
                    "min": 80,
                    "max": 125
                },
                "heavy": 125,
                "note": "Snorted doses are far lower than oral. 4-MMC is very compulsive, so some people choose to pre-measure a total limit for the session.",
                "source": "https://psychonautwiki.org/wiki/Mephedrone"
            },
            "Oral": {
                "unit": "mg",
                "threshold": 50,
                "light": {
                    "min": 50,
                    "max": 100
                },
                "common": {
                    "min": 100,
                    "max": 200
                },
                "strong": {
                    "min": 200,
                    "max": 250
                },
                "heavy": 250,
                "source": "https://psychonautwiki.org/wiki/Mephedrone"
            }
        },
        "routes": [
            {
                "name": "Insufflated",
                "displayName": "Snorted",
                "emoji": "👃",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.02,
                        "max": 0.08,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.08,
                        "max": 0.25,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 2,
                        "max": 12,
                        "label": "After-effects"
                    }
                }
            },
            {
                "name": "Oral",
                "displayName": "Swallowed",
                "emoji": "💊",
                "phases": {
                    "onset": {
                        "min": 0.25,
                        "max": 0.5,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.17,
                        "max": 0.33,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 1,
                        "max": 2,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 2,
                        "max": 12,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 8,
            "cardiotoxicity": 8,
            "dehydration": 6,
            "sleep_deprivation": 7,
            "impulsivity": 8,
            "lethality": 5
        },
        "sleep_strategy": "Very difficult. Stop redosing hours before planned sleep.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "Control: Because 4-MMC's peak is short and compulsive, many people find it helps to pre-measure a set amount and leave the rest at home.",
                        "detail": "The primary danger of 4-MMC is its profound psychological compulsivity. The euphoric peak dissipates within 45–60 minutes, leaving an overwhelming urge to redose. Physical boundaries — only carrying a pre-measured amount — are the most effective harm reduction strategy.",
                        "sources": [
                            {
                                "label": "SaferParty — 4-MMC",
                                "url": "https://www.saferparty.ch/substanzen/4-mmc"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Identity: \"4-MMC\" is now frequently a different cathinone. Test it.",
                        "detail": "European drug-checking services repeatedly find powder sold as 4-MMC (or 3-MMC) that contains no mephedrone at all — commonly 3-CMC, 4-CMC, or N-ethylpentedrone. These are barely researched, strongly compulsive, and in some cases linked to deaths. Appearance and smell are no guide. Use a drug-checking service where available.",
                        "sources": [
                            {
                                "label": "Drugchecking Berlin — Alerts",
                                "url": "https://drugchecking.berlin/aktuelle-warnungen"
                            },
                            {
                                "label": "The Loop — Drug Alerts",
                                "url": "https://wearetheloop.org/drug-alerts"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Supplements (optional): some people pre-load antioxidants (ALA, vitamin C); neuroprotection is unproven in humans.",
                        "detail": "4-MMC generates massive oxidative stress through its action on monoamine transporters. Pre-loading antioxidants provides some neuroprotective buffer against free radical damage."
                    }
                ]
            },
            "during": {
                "focus": "Temperature monitoring and resisting compulsive redosing.",
                "essential": [
                    {
                        "short": "Heat: Keep an eye on your temperature and cool down regularly.",
                        "detail": "4-MMC triggers extreme hyperthermia and tachycardia simultaneously. Core body temperature is worth watching. Taking breaks in ventilated areas helps keep it down."
                    },
                    {
                        "short": "Heart: Vasoconstriction is severe. Watch extremities.",
                        "detail": "4-MMC causes severe peripheral vasoconstriction — blood vessels in the fingers, toes, and extremities shrink dramatically. Cold, blue, or numb extremities are warning signs of dangerous cardiovascular stress."
                    },
                    {
                        "short": "Avoid mixing with alcohol (may worsen neurotoxicity).",
                        "detail": "Preclinical (animal) studies suggest that combining 4-MMC with alcohol may increase oxidative stress and neuronal damage; this has not been confirmed in human trials. The combination also masks intoxication — encouraging heavier use of both — and adds cardiovascular strain.",
                        "sources": [
                            {
                                "label": "Ciudad-Roberts et al. 2016 — Ethanol + mephedrone neurotoxicity (mice)",
                                "url": "https://www.sciencedirect.com/science/article/abs/pii/S0041008X15301654"
                            },
                            {
                                "label": "Mephedrone neurotoxicity — Review (PMC/NIH)",
                                "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC5771050/"
                            }
                        ]
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Crash: Severe. Both dopamine and serotonin are depleted.",
                        "detail": "4-MMC simultaneously depletes both serotonin and dopamine — producing severe lethargy, acute anxiety, paranoia, and deep depressive states. This is one of the most toxic comedowns of any common recreational substance."
                    },
                    {
                        "short": "Environment: Safe, calm space for comedown.",
                        "detail": "The psychological crash can be extreme — anxiety, paranoia, and depression. A dark, quiet, cool environment with trusted people present significantly reduces the severity."
                    }
                ],
                "bonus": [
                    {
                        "short": "Supplements (optional): antioxidants and magnesium.",
                        "detail": "High doses of Vitamin C and Alpha-Lipoic Acid help clear the massive free radical accumulation. Magnesium counteracts severe vascular constriction and neuromuscular tension."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Mood: Expect severe depression and anxiety (2–4 days).",
                        "detail": "The dual depletion of serotonin and dopamine produces one of the most severe comedowns of any recreational substance. This is temporary but can last 2–4 days."
                    }
                ],
                "bonus": [
                    {
                        "short": "Recovery (optional): balanced meals; some people take 5-HTP (only 24+ hours later) and L-Tyrosine.",
                        "detail": "5-HTP provides serotonin precursors, L-Tyrosine provides dopamine precursors. Combined with tryptophan-rich proteins and complex carbohydrates, this supports the slow regeneration of both depleted neurotransmitter systems."
                    }
                ]
            }
        },
        "risks": [
            "Compulsive redosing (extremely addictive pattern)",
            "Severe peripheral vasoconstriction",
            "Dangerous cardiac stress",
            "Neurotoxicity (worsened by alcohol in animal studies)"
        ],
        "mcda": {
            "score": 13,
            "rank": 13,
            "of": 20
        },
        "visualizer_note": "Very high cardiac strain and compulsive redosing; deaths have occurred, and mis-selling as unknown cathinones adds risk."
    },
    "ghb": {
        "id": "ghb",
        "name": "GHB",
        "type": "Depressant",
        "emoji": "💧",
        "color": "#6366f1",
        "duration": 3,
        "dosing": {
            "Oral": {
                "unit": "mL GHB solution (concentration varies ~200–600 mg/mL — see note; GBL is a separate profile)",
                "threshold": 0.5,
                "light": {
                    "min": 1,
                    "max": 1.5
                },
                "common": {
                    "min": 1.5,
                    "max": 2.5
                },
                "strong": {
                    "min": 2.5,
                    "max": 3
                },
                "heavy": 3,
                "note": "⚠️ CRITICAL: These volumes assume GHB solution. GBL is roughly 2–3× stronger by volume — the same mL of GBL can be a 2–3× overdose. Concentration also varies wildly between batches (~200–600 mg/mL, average ~377), so volume alone cannot be trusted. Always start with a low test dose from any new batch or source.",
                "source": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
            }
        },
        "routes": [
            {
                "name": "Oral",
                "displayName": "Drinking",
                "emoji": "💧",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.08,
                        "max": 0.5,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.17,
                        "max": 0.33,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 0.75,
                        "max": 1.5,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 0.75,
                        "max": 1.5,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 3,
                        "max": 8,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 4,
            "cardiotoxicity": 5,
            "dehydration": 2,
            "sleep_deprivation": 2,
            "impulsivity": 6,
            "lethality": 8
        },
        "sleep_strategy": "Sudden, involuntary sleep onset. Prevent aspiration by using recovery position with sober companion.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "⚠️ CRITICAL DANGER: GHB/GBL has an EXTREMELY NARROW therapeutic window. The difference between a recreational dose and a fatal overdose is often a single milliliter or less.",
                        "detail": "GHB/GBL is a CNS depressant with a margin measured in drops. Loss of consciousness occurs from ~3 grams, but purity varies so dramatically (ranging from 200–600 mg/mL) that visual estimation is effectively impossible. A dose that feels like 1 mL might actually contain 200 mg or 600 mg. This is not a substance to experiment with.",
                        "sources": [
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            },
                            {
                                "label": "checkit! Wien — GHB/GBL",
                                "url": "https://checkit.wien/substanz/ghb-gbl/"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Never use with alcohol or any other depressants (benzodiazepines, opioids, CBD, pregabalin, etc.).",
                        "detail": "GHB combined with other CNS depressants causes catastrophic respiratory depression. Even small GHB doses + alcohol → unconsciousness. If vomiting occurs while unconscious, aspiration (choking) is likely fatal. This combination is the leading cause of GHB-related deaths.",
                        "sources": [
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            },
                            {
                                "label": "checkit! Wien — GHB/GBL",
                                "url": "https://checkit.wien/substanz/ghb-gbl/"
                            }
                        ]
                    },
                    {
                        "short": "Measurement: Use a calibrated vial or syringe. Never eyeball. Start low with any new batch.",
                        "detail": "The only harm reduction approach is strict measurement discipline. Visual estimation fails with GHB. Use a marked syringe (0.1 mL precision) and always start conservatively with a new batch to assess its actual concentration.",
                        "sources": [
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ GHB ≠ GBL: GBL is a separate, stronger substance — see its own profile.",
                        "detail": "GBL converts to GHB in the body but, by volume, is roughly 2–3× stronger and faster-acting, so the same millilitres can be a 2–3× overdose. This table is for GHB only — use the dedicated GBL profile for GBL dosing. If you do not know whether a liquid is GHB or GBL, treat it as GBL and start very low.",
                        "sources": [
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            },
                            {
                                "label": "Release — GHB/GBL",
                                "url": "https://www.release.org.uk/drugs/ghb-and-gbl"
                            }
                        ]
                    }
                ],
                "bonus": []
            },
            "during": {
                "focus": "Preventing overdose and respiratory arrest.",
                "essential": [
                    {
                        "short": "⚠️ Overdose signs → CALL EMERGENCY IMMEDIATELY: Loss of consciousness, irregular or stopped breathing, choking, seizure-like movements.",
                        "detail": "GHB overdose manifests as sudden unconsciousness and respiratory suppression. Because the drugs suppresses the gag reflex, vomiting during unconsciousness is silent — the person aspirates into their lungs. This is fatal without immediate medical intervention. Call emergency services (112) immediately if someone stops responding or breathing becomes irregular.",
                        "sources": [
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ NO REDOSING if subjective effects fade. Effects wear off while GHB is still in the bloodstream.",
                        "detail": "GHB subjective effects dissipate within 2–3 hours, but the drug remains active in the blood much longer. Redosing at the same dose increases total blood concentration exponentially → overdose. This is the pattern leading to most GHB hospitalizations.",
                        "sources": [
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            }
                        ]
                    },
                    {
                        "short": "Sober companions: MANDATORY. Someone must stay alert and watch.",
                        "detail": "A sober person must remain conscious and aware of everyone using GHB. They need to: monitor breathing, prevent additional doses, watch for overdose signs, and call emergency services if anything seems wrong. Never use GHB alone or without a completely sober, trained watcher."
                    }
                ],
                "bonus": [
                    {
                        "short": "Hydration: Non-alcoholic beverages only. Max 0.5L/hour.",
                        "detail": "GHB itself causes some fluid retention. Over-hydration + GHB + dancing can increase hyponatremia risk. Keep hydration moderate."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "⚠️ Expect involuntary sleep. Use recovery position (on your side).",
                        "detail": "Sleep onset on GHB is often sudden and involuntary — users may pass out despite intending to stay awake. Ensure you're in a recovery position (on your left side) so that if vomiting occurs, gravity prevents aspiration into the lungs.",
                        "sources": [
                            {
                                "label": "checkit! Wien — GHB/GBL",
                                "url": "https://checkit.wien/substanz/ghb-gbl/"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ If regular use: Dependence can develop after just weeks.",
                        "detail": "Physical and psychological dependence develops rapidly with repeated GHB use. Withdrawal is severe: anxiety, panic, insomnia (persisting for days), trembling, nausea, delirium with hallucinations. Withdrawal MUST occur under medical supervision. Do not attempt to quit suddenly.",
                        "sources": [
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            },
                            {
                                "label": "checkit! Wien — GHB/GBL",
                                "url": "https://checkit.wien/substanz/ghb-gbl/"
                            }
                        ]
                    }
                ],
                "bonus": []
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Recovery: Electrolytes and normal nutrition.",
                        "detail": "GHB leaves the system relatively quickly, but sleep disruption and the intensity of the experience create fatigue. Rehydrate with electrolyte drinks and resume normal eating."
                    }
                ],
                "bonus": []
            }
        },
        "risks": [
            "EXTREMELY narrow therapeutic window — overdose possible with minimal dose increase",
            "Respiratory arrest and death (especially with alcohol or depressants)",
            "Choking/aspiration during unconsciousness",
            "Sudden involuntary sleep onset",
            "Rapid dependence (physical and psychological)",
            "Severe withdrawal requiring medical supervision",
            "Memory loss (anterograde amnesia)"
        ],
        "mcda": {
            "score": 18,
            "rank": 9,
            "of": 20
        },
        "visualizer_note": "The low 'strain' bars hide the real danger — an extremely narrow dose window and respiratory-depression overdose, especially with alcohol."
    },
    "gbl": {
        "id": "gbl",
        "name": "GBL",
        "type": "Depressant",
        "emoji": "🧪",
        "color": "#818cf8",
        "duration": 2,
        "dosing": {
            "Oral": {
                "unit": "mL pure GBL — extremely potent by volume",
                "threshold": 0.3,
                "light": {
                    "min": 0.5,
                    "max": 0.9
                },
                "common": {
                    "min": 0.9,
                    "max": 1.5
                },
                "strong": {
                    "min": 1.5,
                    "max": 2
                },
                "heavy": 2,
                "note": "⚠️ GBL is ~2–3× stronger by volume than GHB and faster-acting (1 mL ≈ 1.66 g GHB salt). NEVER apply a GHB dose to GBL. Effects hit in 3–10 min; over ~2 mL can cause sudden heavy sleep. Always dilute in a soft drink (neat GBL is caustic and burns), measure with a 0.1 mL syringe, and start with a low test dose from any new batch.",
                "source": "https://psychonautwiki.org/wiki/GBL"
            }
        },
        "routes": [
            {
                "name": "Oral",
                "displayName": "Drinking (diluted)",
                "emoji": "🧪",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.05,
                        "max": 0.17,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.08,
                        "max": 0.17,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 2,
                        "max": 6,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 4,
            "cardiotoxicity": 5,
            "dehydration": 2,
            "sleep_deprivation": 2,
            "impulsivity": 6,
            "lethality": 8
        },
        "sleep_strategy": "Sudden, involuntary sleep onset — even faster than GHB. Never use near sleep without a sober companion; use the recovery position.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "⚠️ GBL is NOT GHB: it is ~2–3× stronger by volume and hits in minutes.",
                        "detail": "GBL is a precursor the body rapidly converts to GHB. By volume it is roughly 2–3× stronger and faster-acting (1 mL ≈ 1.66 g GHB salt), so a volume that is a common GHB dose can be a serious GBL overdose. Never carry over GHB dosing. If you are unsure which liquid you have, treat it as GBL and start very low.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — GBL",
                                "url": "https://psychonautwiki.org/wiki/GBL"
                            },
                            {
                                "label": "Release — GHB/GBL",
                                "url": "https://www.release.org.uk/drugs/ghb-and-gbl"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ CRITICAL: The margin between a normal dose and overdose is tiny — often under 0.5 mL.",
                        "detail": "GBL is a CNS depressant with an extremely narrow window. Because it is so concentrated, a difference of a fraction of a millilitre matters: loss of consciousness and respiratory depression can follow a small increase in dose. This is not a substance to estimate by eye.",
                        "sources": [
                            {
                                "label": "checkit! Wien — GHB/GBL",
                                "url": "https://checkit.wien/substanz/ghb-gbl/"
                            },
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Never use with alcohol or any other depressant (benzodiazepines, opioids, pregabalin).",
                        "detail": "GBL (as GHB) combined with other CNS depressants causes catastrophic respiratory depression. Even small amounts with alcohol can cause unconsciousness; vomiting while unconscious leads to fatal aspiration. This combination is the leading cause of GHB/GBL deaths.",
                        "sources": [
                            {
                                "label": "checkit! Wien — GHB/GBL",
                                "url": "https://checkit.wien/substanz/ghb-gbl/"
                            },
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            }
                        ]
                    },
                    {
                        "short": "Dilute it: mix a measured dose into a soft drink — never swallow GBL neat.",
                        "detail": "Undiluted GBL is caustic and can burn the mouth, throat and stomach. Always dilute a measured dose in a non-alcoholic soft drink, measure with a 0.1 mL syringe, keep a written note of what you took and when, and start low with any new batch.",
                        "sources": [
                            {
                                "label": "PsychonautWiki — GBL",
                                "url": "https://psychonautwiki.org/wiki/GBL"
                            }
                        ]
                    }
                ],
                "bonus": []
            },
            "during": {
                "focus": "Preventing overdose and respiratory arrest.",
                "essential": [
                    {
                        "short": "⚠️ Overdose signs → CALL 112 IMMEDIATELY: cannot be woken, irregular or stopped breathing, choking, seizure-like movements.",
                        "detail": "GBL overdose causes sudden unconsciousness and respiratory suppression. Because it suppresses the gag reflex, vomiting while unconscious is silent and leads to aspiration — fatal without immediate help. Put the person in the recovery position and call emergency services the moment breathing becomes irregular or they cannot be woken.",
                        "sources": [
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ NO REDOSING when effects fade — GBL is still in your blood.",
                        "detail": "Subjective effects fade within 1–2 hours, but the drug is still active. Taking another dose stacks on top of the first and pushes total blood levels toward overdose. Waiting out the urge is essential; most GBL/GHB hospitalisations follow redosing too soon.",
                        "sources": [
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            }
                        ]
                    },
                    {
                        "short": "Sober companion: MANDATORY. Someone must stay alert and watch breathing.",
                        "detail": "A completely sober person must watch everyone using GBL — monitor breathing, prevent extra doses, watch for overdose signs, and call 112 if anything seems wrong. Never use GBL alone."
                    }
                ],
                "bonus": [
                    {
                        "short": "Hydration: non-alcoholic drinks only, max ~0.5 L/hour.",
                        "detail": "Keep hydration moderate and strictly non-alcoholic. Over-hydration adds little benefit and any alcohol is dangerous with GBL."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "⚠️ Expect sudden, involuntary sleep — use the recovery position (on the side).",
                        "detail": "Sleep onset on GBL is often abrupt and unavoidable. Lie on your side so that if vomiting occurs, gravity keeps the airway clear. A sober person should keep watching breathing until you are fully alert.",
                        "sources": [
                            {
                                "label": "checkit! Wien — GHB/GBL",
                                "url": "https://checkit.wien/substanz/ghb-gbl/"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Dependence forms fast: daily use can cause dependence within weeks.",
                        "detail": "Regular (especially daily) GBL/GHB use causes rapid physical dependence. Withdrawal is severe — anxiety, panic, insomnia for days, trembling, nausea, and delirium with hallucinations — and must be managed under medical supervision. Do not stop abruptly after a period of frequent use.",
                        "sources": [
                            {
                                "label": "Jellinek — GHB",
                                "url": "https://www.jellinek.nl/en/alcohol-drugs-behavior/ghb/"
                            },
                            {
                                "label": "checkit! Wien — GHB/GBL",
                                "url": "https://checkit.wien/substanz/ghb-gbl/"
                            }
                        ]
                    }
                ],
                "bonus": []
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Recovery: rehydrate and eat normally once fully alert.",
                        "detail": "GBL leaves the body quickly, but disrupted sleep and the intensity of the experience cause fatigue. Rehydrate with electrolyte drinks and resume normal eating once you are fully awake and oriented."
                    }
                ],
                "bonus": []
            }
        },
        "risks": [
            "EXTREMELY narrow therapeutic window — overdose from a fraction of a millilitre",
            "Faster onset and higher potency than GHB — easy to misjudge",
            "Respiratory arrest and death (especially with alcohol or depressants)",
            "Choking/aspiration during sudden unconsciousness",
            "Caustic if taken undiluted (burns mouth/throat)",
            "Rapid dependence and severe withdrawal (medical supervision required)"
        ],
        "mcda": {
            "score": 18,
            "rank": 9,
            "of": 20,
            "note": "assessed together with GHB"
        },
        "visualizer_note": "Same lethal profile as GHB but harder to dose (stronger by volume, faster onset) — the narrow-window overdose risk is the headline."
    },
    "heroin": {
        "id": "heroin",
        "name": "Heroin (Diamorphine)",
        "type": "Opioid",
        "emoji": "🩸",
        "color": "#dc2626",
        "duration": 4,
        "dosing": {
            "Smoked": {
                "unit": "mg (street purity ~15–45%; adjust accordingly)",
                "threshold": 5,
                "light": {
                    "min": 5,
                    "max": 10
                },
                "common": {
                    "min": 10,
                    "max": 20
                },
                "strong": {
                    "min": 20,
                    "max": 30
                },
                "heavy": 30,
                "note": "⚠️ These tiers are street-weight at typical purity; actual diamorphine content is far lower and varies wildly (10–72%). Start with a tiny test dose from any new batch. For reference, a lethal dose of PURE diamorphine in opioid-naive people is only ~30 mg IV / ~60 mg by other routes — do not confuse this with the street-weight tiers above.",
                "source": "https://wiki.tripsit.me/wiki/Heroin"
            },
            "Insufflated": {
                "unit": "mg (street purity ~15–45%)",
                "threshold": 5,
                "light": {
                    "min": 5,
                    "max": 10
                },
                "common": {
                    "min": 10,
                    "max": 20
                },
                "strong": {
                    "min": 20,
                    "max": 30
                },
                "heavy": 30,
                "note": "Snorted doses are typically a little higher than smoked. Causes nasal mucosa and septum damage — use personal, rounded-tip tubes and rinse nasal passages after use.",
                "source": "https://www.saferparty.ch/substanzen/heroin"
            }
        },
        "routes": [
            {
                "name": "Smoked",
                "displayName": "Smoked (foil)",
                "emoji": "🚬",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.005,
                        "max": 0.017,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.05,
                        "max": 0.17,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 1.5,
                        "max": 3,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 3,
                        "max": 8,
                        "label": "After-effects"
                    }
                }
            },
            {
                "name": "Insufflated",
                "displayName": "Snorted",
                "emoji": "👃",
                "phases": {
                    "onset": {
                        "min": 0.03,
                        "max": 0.08,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.08,
                        "max": 0.25,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 0.5,
                        "max": 1.5,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 1.5,
                        "max": 3,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 3,
                        "max": 8,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 2,
            "cardiotoxicity": 3,
            "dehydration": 2,
            "sleep_deprivation": 1,
            "impulsivity": 7,
            "lethality": 8
        },
        "sleep_strategy": "Heroin induces sedation and sleep. Place the person in recovery position to prevent aspiration. Never leave someone nodding off unmonitored.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "⚠️ LETHAL OVERDOSE RISK: Street purity varies 10–72%. Any new batch, source, or period of abstinence (even 2 days) dramatically changes overdose threshold.",
                        "detail": "Heroin purity is wildly inconsistent. Average German street purity was ~18.7% (2021 data) and ranges from 10–72%; supply disruption since 2023 has made it even less predictable. Pharmaceutical diamorphine is near-pure — several times stronger by weight than typical street heroin. After even brief abstinence (2–5 days), opioid tolerance falls sharply — returning to a previous dose after a break is the single most common cause of fatal heroin overdose.",
                        "sources": [
                            {
                                "label": "Drugchecking Berlin — Heroin",
                                "url": "https://drugchecking.berlin/substanzen/diamorphin-heroin"
                            },
                            {
                                "label": "SaferParty — Heroin",
                                "url": "https://www.saferparty.ch/substanzen/heroin"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Contamination: Street heroin may contain fentanyl or nitazenes. Test it; carry extra naloxone.",
                        "detail": "Synthetic opioids — fentanyl and especially nitazenes — increasingly turn up in the European heroin supply and are far stronger than heroin itself. They are a leading driver of recent overdose deaths across several EU countries. Fentanyl test strips detect fentanyl but not all nitazenes, so a negative test is not a guarantee. Because these opioids are potent and can outlast a single naloxone dose, carry several doses and be ready to re-administer.",
                        "sources": [
                            {
                                "label": "EUDA — Overdose deaths, nitazenes (2025)",
                                "url": "https://www.euda.europa.eu/"
                            },
                            {
                                "label": "The Loop — Drug Alerts",
                                "url": "https://wearetheloop.org/drug-alerts"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Never use alone. Have naloxone (Narcan) available and ensure companions know how to use it.",
                        "detail": "Naloxone is an opioid antagonist that reverses respiratory depression within seconds. It is available as a nasal spray (prescription required in some countries). Every person present should know the signs of overdose (blue lips, slow/stopped breathing, unresponsiveness) and how to administer naloxone. Supervised consumption facilities offer the safest environment where available.",
                        "sources": [
                            {
                                "label": "Drugchecking Berlin — Heroin",
                                "url": "https://drugchecking.berlin/substanzen/diamorphin-heroin"
                            },
                            {
                                "label": "TripSit — Heroin",
                                "url": "https://wiki.tripsit.me/wiki/Heroin"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Never combine with alcohol, benzodiazepines, GHB/GBL, ketamine, or other depressants.",
                        "detail": "Combining opioids with any other CNS depressant causes synergistic respiratory depression that rapidly leads to unconsciousness, aspiration, and death. This is the leading cause of opioid-related fatalities worldwide. Even small amounts of alcohol with heroin can be fatal.",
                        "sources": [
                            {
                                "label": "TripSit — Drug Combinations",
                                "url": "https://combo.tripsit.me"
                            },
                            {
                                "label": "checkit! Wien — Heroin",
                                "url": "https://checkit.wien/substanz/heroin/"
                            },
                            {
                                "label": "SaferParty — Heroin",
                                "url": "https://www.saferparty.ch/substanzen/heroin"
                            }
                        ]
                    },
                    {
                        "short": "Test dose: Always start with a tiny amount from any new batch.",
                        "detail": "Use drug-checking services where available. With any new source or batch, start with a fraction of what you would normally use. Purity fluctuations mean a dose that was safe last week may be lethal today. Do not rely on dosing advice from regular users — their tolerance creates lethal doses for those without it.",
                        "sources": [
                            {
                                "label": "SaferParty — Heroin",
                                "url": "https://www.saferparty.ch/substanzen/heroin"
                            },
                            {
                                "label": "Drugchecking Berlin — Heroin",
                                "url": "https://drugchecking.berlin/substanzen/diamorphin-heroin"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Route: Smoking (foil) is significantly safer than injection.",
                        "detail": "Smoking produces a slower onset and lower peak blood concentration than injection, substantially reducing overdose risk. Injection carries additional risks: vein collapse, abscesses, endocarditis, and blood-borne infections (HIV, Hepatitis C). If injecting, use sterile equipment exclusively and never share needles, water, or filters.",
                        "sources": [
                            {
                                "label": "Drugchecking Berlin — Heroin",
                                "url": "https://drugchecking.berlin/substanzen/diamorphin-heroin"
                            }
                        ]
                    },
                    {
                        "short": "Smoking equipment: Use uncoated aluminium foil and personal tubes. Do not share.",
                        "detail": "Sharing smoking tubes transmits Hepatitis C and herpes. Use only uncoated aluminium foil (food-grade). Each person should have their own tube with a smooth, rounded tip to prevent oral cuts.",
                        "sources": [
                            {
                                "label": "checkit! Wien — Heroin",
                                "url": "https://checkit.wien/substanz/heroin/"
                            }
                        ]
                    }
                ]
            },
            "during": {
                "focus": "Preventing respiratory arrest and aspiration.",
                "essential": [
                    {
                        "short": "⚠️ OVERDOSE: Blue lips/fingertips, slow or stopped breathing, unresponsiveness → CALL 112 IMMEDIATELY. Administer naloxone if available.",
                        "detail": "Opioid overdose causes life-threatening respiratory depression. Breathing slows to 2–4 breaths per minute or stops entirely. Blue-tinted cold skin, blood pressure collapse, pinpoint pupils, and unresponsiveness are emergency signs. Place the person in recovery position, call emergency services, and administer naloxone nasal spray if available. Naloxone wears off faster than heroin — the person may relapse into overdose and need repeated doses.",
                        "sources": [
                            {
                                "label": "Drugchecking Berlin — Heroin",
                                "url": "https://drugchecking.berlin/substanzen/diamorphin-heroin"
                            },
                            {
                                "label": "checkit! Wien — Heroin",
                                "url": "https://checkit.wien/substanz/heroin/"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Speedball danger: Never combine heroin with cocaine or stimulants.",
                        "detail": "Stimulants increase respiration rate, masking the respiratory depression caused by opioids. When the stimulant wears off first, the full opioid dose may suddenly overwhelm the respiratory system, causing delayed fatal respiratory arrest. This combination causes extreme cardiovascular strain.",
                        "sources": [
                            {
                                "label": "TripSit — Drug Combinations",
                                "url": "https://combo.tripsit.me"
                            },
                            {
                                "label": "SaferParty — Heroin",
                                "url": "https://www.saferparty.ch/substanzen/heroin"
                            }
                        ]
                    },
                    {
                        "short": "Nausea: Vomiting is common. Stay upright or in recovery position.",
                        "detail": "Heroin commonly causes nausea and vomiting, especially at higher doses or in opioid-naive users. If someone is sedated and vomiting, the suppressed gag reflex means aspiration (inhaling vomit) is a severe risk. Always ensure they are on their side in the recovery position."
                    }
                ],
                "bonus": [
                    {
                        "short": "Avoid operating machinery, driving, or swimming.",
                        "detail": "Heroin severely impairs coordination, reaction time, and consciousness. The sedative effects can cause sudden loss of consciousness (\"nodding\") without warning."
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "⚠️ Recovery position: If sedated, place on their side. Monitor breathing continuously.",
                        "detail": "Opioid-induced sedation combined with nausea creates a high aspiration risk. The person must be placed on their side (recovery position) and breathing must be monitored continuously. Never leave someone nodding off alone.",
                        "sources": [
                            {
                                "label": "Drugchecking Berlin — Heroin",
                                "url": "https://drugchecking.berlin/substanzen/diamorphin-heroin"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Dependence: Physical dependence develops rapidly with regular use. Withdrawal begins 8–12 hours after last dose.",
                        "detail": "Regular multi-week use causes tolerance, requiring increased amounts. Withdrawal symptoms include sweating, chills, runny eyes/nose, vomiting, diarrhea, severe muscle cramps, insomnia, and extreme anxiety. Medical supervision for withdrawal is strongly recommended.",
                        "sources": [
                            {
                                "label": "SaferParty — Heroin",
                                "url": "https://www.saferparty.ch/substanzen/heroin"
                            },
                            {
                                "label": "checkit! Wien — Heroin",
                                "url": "https://checkit.wien/substanz/heroin/"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Hydration and light nutrition when alert.",
                        "detail": "Once the user is alert and oriented, rehydrate with water or electrolyte drinks. Heroin suppresses appetite and causes constipation — light, easily digestible meals support recovery."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Do not redose to avoid withdrawal. Maintain consumption breaks of multiple days.",
                        "detail": "The desire to avoid withdrawal symptoms drives compulsive use patterns. Each additional use deepens physical dependence. Maintaining breaks of multiple days between uses significantly reduces dependence risk, though this remains a harm reduction measure — no pattern of heroin use is safe.",
                        "sources": [
                            {
                                "label": "SaferParty — Heroin",
                                "url": "https://www.saferparty.ch/substanzen/heroin"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Recovery: Rehydrate, eat balanced meals, prioritise sleep.",
                        "detail": "Heroin disrupts normal appetite, hydration, and bowel function. Fibre-rich foods help counter constipation. Rest and normal sleep cycles support physical recovery."
                    }
                ]
            }
        },
        "risks": [
            "Fatal respiratory depression (especially with other depressants)",
            "Aspiration (choking on vomit while unconscious)",
            "Extreme overdose risk after tolerance break (even 2 days)",
            "Wildly variable street purity (10–72%)",
            "Contamination with fentanyl or nitazenes (far stronger; may resist naloxone)",
            "Rapid physical and psychological dependence",
            "Severe withdrawal requiring medical supervision",
            "Blood-borne infections from shared equipment (HIV, Hepatitis C)"
        ],
        "mcda": {
            "score": 55,
            "rank": 2,
            "of": 20
        },
        "visualizer_note": "The strain axes look mild, but respiratory-depression overdose is the dominant, ever-present risk — heightened by tolerance loss and fentanyl/nitazene contamination."
    },
    "methamphetamine": {
        "id": "methamphetamine",
        "name": "Methamphetamine",
        "type": "Stimulant",
        "emoji": "💎",
        "color": "#ef4444",
        "duration": 12,
        "dosing": {
            "Oral": {
                "unit": "mg",
                "threshold": 5,
                "light": {
                    "min": 5,
                    "max": 10
                },
                "common": {
                    "min": 10,
                    "max": 25
                },
                "strong": {
                    "min": 25,
                    "max": 50
                },
                "heavy": 50,
                "note": "Oral is the safest route. Full stomach delays absorption. Crystal purity averages ~98% — much more potent than street amphetamine.",
                "source": "https://www.saferparty.ch/substanzen/methamphetamin"
            },
            "Insufflated": {
                "unit": "mg",
                "threshold": 5,
                "light": {
                    "min": 5,
                    "max": 10
                },
                "common": {
                    "min": 10,
                    "max": 30
                },
                "strong": {
                    "min": 30,
                    "max": 50
                },
                "heavy": 50,
                "note": "Causes severe nasal mucosa damage. Use personal rounded-tip tubes. Do not share equipment.",
                "source": "https://www.saferparty.ch/substanzen/methamphetamin"
            },
            "Smoked": {
                "unit": "mg",
                "threshold": 5,
                "light": {
                    "min": 5,
                    "max": 10
                },
                "common": {
                    "min": 10,
                    "max": 20
                },
                "strong": {
                    "min": 20,
                    "max": 60
                },
                "heavy": 60,
                "note": "Smoking causes lung damage and elevated cancer risk. Rapid onset increases addiction potential.",
                "source": "https://psychonautwiki.org/wiki/Methamphetamine"
            }
        },
        "routes": [
            {
                "name": "Oral",
                "displayName": "Swallowed",
                "emoji": "💊",
                "isDefault": true,
                "phases": {
                    "onset": {
                        "min": 0.5,
                        "max": 2,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.5,
                        "max": 1,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 3,
                        "max": 6,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 3,
                        "max": 6,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 12,
                        "max": 70,
                        "label": "After-effects"
                    }
                }
            },
            {
                "name": "Insufflated",
                "displayName": "Snorted",
                "emoji": "👃",
                "phases": {
                    "onset": {
                        "min": 0.02,
                        "max": 0.08,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.17,
                        "max": 0.5,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 2,
                        "max": 5,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 3,
                        "max": 6,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 12,
                        "max": 70,
                        "label": "After-effects"
                    }
                }
            },
            {
                "name": "Smoked",
                "displayName": "Smoked",
                "emoji": "🚬",
                "phases": {
                    "onset": {
                        "min": 0.001,
                        "max": 0.03,
                        "label": "Onset"
                    },
                    "come_up": {
                        "min": 0.08,
                        "max": 0.25,
                        "label": "Come-up"
                    },
                    "peak": {
                        "min": 1,
                        "max": 3,
                        "label": "Peak"
                    },
                    "come_down": {
                        "min": 3,
                        "max": 6,
                        "label": "Come-down"
                    },
                    "after_effects": {
                        "min": 12,
                        "max": 70,
                        "label": "After-effects"
                    }
                }
            }
        ],
        "visualizer": {
            "neurotoxicity": 8,
            "cardiotoxicity": 8,
            "dehydration": 7,
            "sleep_deprivation": 8,
            "impulsivity": 8,
            "lethality": 6
        },
        "sleep_strategy": "Sleep may be impossible for 12–30+ hours. Do not redose to delay the comedown. Plan adequate recovery time. Benzodiazepines should NOT be used as sleep aids without medical supervision.",
        "phases": {
            "before": {
                "essential": [
                    {
                        "short": "⚠️ EXTREMELY HIGH ADDICTION POTENTIAL: Methamphetamine produces one of the strongest psychological dependencies of any recreational substance.",
                        "detail": "Methamphetamine triggers simultaneous massive release of dopamine, noradrenaline, and serotonin, producing intense euphoria that the brain rapidly becomes dependent on. Very high addiction potential with both psychological and physical withdrawal symptoms. Space sessions at least 4 weeks apart to reduce (but not eliminate) dependence risk.",
                        "sources": [
                            {
                                "label": "SaferParty — Methamphetamine",
                                "url": "https://www.saferparty.ch/substanzen/methamphetamin"
                            },
                            {
                                "label": "Drugchecking Berlin — Crystal",
                                "url": "https://drugchecking.berlin/substanzen/methamphetamin-crystal"
                            }
                        ]
                    },
                    {
                        "short": "Crystal purity averages ~98%. This is NOT the same as street amphetamine (speed) — doses are far lower.",
                        "detail": "Crystal methamphetamine hydrochloride has a median purity of ~98.1%, compared to street amphetamine which is typically 10–30% pure. A dose of methamphetamine that looks similar to a speed dose can be 3–10× more pharmacologically active. Never apply amphetamine dosing knowledge to methamphetamine.",
                        "sources": [
                            {
                                "label": "Drugchecking Berlin — Crystal",
                                "url": "https://drugchecking.berlin/substanzen/methamphetamin-crystal"
                            }
                        ]
                    },
                    {
                        "short": "Eat a balanced meal before use. Some people also take vitamins C and D and minerals (iron, calcium, magnesium).",
                        "detail": "Methamphetamine suppresses hunger, thirst, and pain perception for 6–30+ hours. The body continues to burn calories and deplete nutrients throughout. Pre-loading with balanced nutrition and supplements mitigates the severe nutritional depletion that contributes to the harsh comedown.",
                        "sources": [
                            {
                                "label": "SaferParty — Methamphetamine",
                                "url": "https://www.saferparty.ch/substanzen/methamphetamin"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Use drug-checking services where available. Start with a small test dose.",
                        "detail": "While crystal meth purity is typically high, adulterants and substitution do occur. Drug checking confirms identity and purity. Always start with a fraction of the intended dose from a new batch."
                    },
                    {
                        "short": "Plan your time: Set a hard stop time and recovery period before you start.",
                        "detail": "The most dangerous pattern with methamphetamine is extending sessions to delay the comedown. Decide in advance when you will stop and ensure you have at least 24–48 hours of recovery time scheduled afterward."
                    }
                ]
            },
            "during": {
                "focus": "Cardiovascular monitoring, hydration, and preventing compulsive redosing.",
                "essential": [
                    {
                        "short": "⚠️ EMERGENCY: Chest pain, severe headache, seizures, extreme confusion, or body temperature >39°C → CALL 112 IMMEDIATELY.",
                        "detail": "Methamphetamine overdose can cause fatal pulmonary oedema, cerebral haemorrhage, cardiac arrhythmias, acute heart failure, and severe hyperthermia. These are medical emergencies requiring immediate intervention. Stroke and sudden cardiac death can occur even in young, healthy users.",
                        "sources": [
                            {
                                "label": "SaferParty — Methamphetamine",
                                "url": "https://www.saferparty.ch/substanzen/methamphetamin"
                            },
                            {
                                "label": "checkit! Wien — Methamphetamine",
                                "url": "https://checkit.wien/substanz/methamphetamin/"
                            }
                        ]
                    },
                    {
                        "short": "Do not redose. Methamphetamine lasts 6–30 hours. Redosing dramatically increases toxicity and addiction risk.",
                        "detail": "Methamphetamine is slowly metabolised by the body. Each redose adds to the total circulating dose without the previous amount being cleared. This compounds cardiovascular strain, neurotoxicity, and hyperthermia exponentially. The compulsion to redose is itself a primary danger.",
                        "sources": [
                            {
                                "label": "SaferParty — Methamphetamine",
                                "url": "https://www.saferparty.ch/substanzen/methamphetamin"
                            }
                        ]
                    },
                    {
                        "short": "Hydration: Drink non-alcoholic fluids with electrolytes. Max 0.5L/hour.",
                        "detail": "Methamphetamine causes dehydration through elevated body temperature, vasoconstriction, and suppressed thirst. Drink steadily but avoid over-hydration. Electrolyte drinks replace sodium lost through sweating.",
                        "sources": [
                            {
                                "label": "checkit! Wien — Methamphetamine",
                                "url": "https://checkit.wien/substanz/methamphetamin/"
                            }
                        ]
                    },
                    {
                        "short": "⚠️ Never combine with alcohol — masks overdose symptoms and causes severe organ strain.",
                        "detail": "Alcohol masks the stimulant effects, encouraging higher doses of both substances. The combination causes extreme cardiovascular stress, liver toxicity, and dramatically increases risk of aggressive/violent behaviour. When the stimulant wears off, the full sedative load of the alcohol hits — risking respiratory depression and aspiration.",
                        "sources": [
                            {
                                "label": "SaferParty — Methamphetamine",
                                "url": "https://www.saferparty.ch/substanzen/methamphetamin"
                            },
                            {
                                "label": "Drugchecking Berlin — Crystal",
                                "url": "https://drugchecking.berlin/substanzen/methamphetamin-crystal"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Take cooling breaks. Eat light foods and fruits even if not hungry.",
                        "detail": "Methamphetamine elevates core body temperature and suppresses appetite. Active cooling (moving to ventilated areas, cold water on wrists) and forcing light meals maintain blood sugar and prevent dangerous hyperthermia."
                    },
                    {
                        "short": "⚠️ Drug interaction: SSRIs/SNRIs (fluoxetine, sertraline, paroxetine, duloxetine, bupropion) dangerously potentiate methamphetamine.",
                        "detail": "These medications inhibit the CYP2D6 liver enzyme responsible for metabolising methamphetamine, causing dangerously elevated and prolonged blood concentrations. If you are taking any psychiatric medication, consult a doctor before use.",
                        "sources": [
                            {
                                "label": "Drugchecking Berlin — Crystal",
                                "url": "https://drugchecking.berlin/substanzen/methamphetamin-crystal"
                            }
                        ]
                    }
                ]
            },
            "after": {
                "essential": [
                    {
                        "short": "Crash: Expect severe depression, exhaustion, irritability, and intense hunger (24–72 hours).",
                        "detail": "The methamphetamine comedown is one of the most severe of any stimulant. Massive dopamine depletion produces profound depression, anxiety, and exhaustion. Irritability, concentration problems, and insomnia may persist for days. This is temporary and will resolve — do not redose to manage the comedown.",
                        "sources": [
                            {
                                "label": "Drugchecking Berlin — Crystal",
                                "url": "https://drugchecking.berlin/substanzen/methamphetamin-crystal"
                            },
                            {
                                "label": "checkit! Wien — Methamphetamine",
                                "url": "https://checkit.wien/substanz/methamphetamin/"
                            }
                        ]
                    },
                    {
                        "short": "Environment: Dark, quiet, safe space. Trusted companions.",
                        "detail": "Post-methamphetamine states can include paranoia, anxiety, and agitation. A calm, controlled environment with trusted people reduces psychological distress and prevents risky behaviour during the comedown."
                    }
                ],
                "bonus": [
                    {
                        "short": "Supplements (optional): balanced meals with protein and carbs; some people add vitamin C and magnesium.",
                        "detail": "Vitamin C and magnesium support recovery: vitamin C for general antioxidant and nutrient replenishment (it does not meaningfully speed methamphetamine excretion, contrary to a common claim), and magnesium to counteract vasoconstriction and muscle tension. Protein-rich meals provide amino acid precursors for neurotransmitter replenishment."
                    }
                ]
            },
            "next_morning": {
                "essential": [
                    {
                        "short": "Recovery takes days, not hours. Using more stimulants to push through only deepens the crash — rest is what helps.",
                        "detail": "The brain requires extended time to replenish depleted dopamine, noradrenaline, and serotonin stores. Using caffeine or other stimulants to push through the comedown delays recovery and compounds neurotoxicity. Plan for 24–48+ hours of rest and reduced function.",
                        "sources": [
                            {
                                "label": "SaferParty — Methamphetamine",
                                "url": "https://www.saferparty.ch/substanzen/methamphetamin"
                            }
                        ]
                    }
                ],
                "bonus": [
                    {
                        "short": "Mental health: If anxiety, paranoia, or suicidal thoughts persist beyond 72 hours, seek professional help.",
                        "detail": "Methamphetamine use can trigger substance-induced psychosis including paranoia, delusions, and hallucinations. If psychiatric symptoms persist beyond the expected comedown window (2–4 days), this may indicate a more serious reaction requiring medical attention.",
                        "sources": [
                            {
                                "label": "checkit! Wien — Methamphetamine",
                                "url": "https://checkit.wien/substanz/methamphetamin/"
                            },
                            {
                                "label": "SaferParty — Methamphetamine",
                                "url": "https://www.saferparty.ch/substanzen/methamphetamin"
                            }
                        ]
                    }
                ]
            }
        },
        "risks": [
            "Fatal cardiovascular events (stroke, heart attack, arrhythmia)",
            "Severe hyperthermia",
            "Substance-induced psychosis (paranoia, hallucinations)",
            "One of the highest addiction potentials of any recreational substance",
            "Extreme neurotoxicity and suspected irreversible brain changes",
            "Severe comedown lasting 2–4 days (depression, anxiety, exhaustion)",
            "Significantly elevated Parkinson's disease risk with chronic use"
        ],
        "mcda": {
            "score": 33,
            "rank": 4,
            "of": 20
        },
        "visualizer_note": "Extreme across the board — high neurotoxicity, cardiac strain, addiction and overdose (stroke, cardiac arrest, hyperthermia)."
    }
};
