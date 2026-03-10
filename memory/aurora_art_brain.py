"""
AURORA'S ART BRAIN - Digital Painting Master Knowledge Base
Source: Digital Painting Techniques: Masters Collection Volume 1
Synthesized from 20+ professional digital artists

This module contains core artistic principles and techniques for Aurora to reference
when creating digital artwork.
"""

# ============================================================================
# CORE ARTISTIC PHILOSOPHY
# ============================================================================

CORE_PRINCIPLES = {
    "foundation": {
        "primary_rule": "VALUE before COLOR - If it doesn't work in grayscale, color won't save it",
        "form_rule": "FORM before DETAIL - Everything is spheres, cylinders, cubes",
        "knowledge_rule": "UNDERSTANDING before TECHNIQUE - Know WHY before learning HOW",
        "master_quote": "If you understand how light falls on a sphere, you can paint anything"
    },
    
    "painting_philosophy": {
        "brushwork": "2-5 brushes total - skill over quantity",
        "palette": "5-7 colors maximum - mastery over variety", 
        "workflow": "Work large-to-small, general-to-specific",
        "checking": "Flip image frequently, take breaks, fresh eyes catch errors"
    }
}

# ============================================================================
# VALUE STRUCTURE SYSTEM
# ============================================================================

class ValueStructure:
    """Core value and lighting knowledge"""
    
    FIVE_VALUE_SYSTEM = {
        1: {"name": "Darkest Shadow", "range": "1-2/10", "use": "Deepest recesses, cast shadows"},
        2: {"name": "Core Shadow", "range": "3-4/10", "use": "Form shadow, where light can't reach"},
        3: {"name": "Mid-tone", "range": "5-6/10", "use": "Base color, transition zones"},
        4: {"name": "Highlight", "range": "7-8/10", "use": "Lit surfaces, reflected light"},
        5: {"name": "Brightest Light", "range": "9-10/10", "use": "Direct light source, wetness, metal"}
    }
    
    DEPTH_ZONES = {
        "foreground": {
            "contrast": "High - full range of values",
            "saturation": "Full saturation possible",
            "detail": "Sharp, crisp details",
            "edges": "Hard edges predominate",
            "blacks": "True blacks allowed"
        },
        "midground": {
            "contrast": "Medium - reduced value range",
            "saturation": "Medium saturation",
            "detail": "Less detail than foreground",
            "edges": "Mix of hard and soft",
            "blacks": "Dark grays instead of black"
        },
        "background": {
            "contrast": "Low - compressed values",
            "saturation": "Desaturated, fades to atmosphere color",
            "detail": "Minimal detail, suggestions only",
            "edges": "Soft edges predominate",
            "blacks": "No pure blacks"
        }
    }
    
    GRAYSCALE_WORKFLOW = [
        "1. Block entire composition in grayscale values",
        "2. Establish light source and shadow directions",
        "3. Group values into 3-5 distinct zones",
        "4. Check readability by squinting or blurring",
        "5. Only add color after value structure is solid"
    ]

# ============================================================================
# FORM AND LIGHT
# ============================================================================

class FormFundamentals:
    """Understanding 3D form and lighting"""
    
    BASIC_FORMS = {
        "sphere": {
            "examples": ["head", "eye", "joints", "fruits", "planets"],
            "light_pattern": "Smooth gradient from highlight to core shadow with reflected light",
            "critical_feature": "Terminator line follows curvature"
        },
        "cylinder": {
            "examples": ["limbs", "neck", "tree trunks", "torso"],
            "light_pattern": "Parallel bands of light/shadow",
            "critical_feature": "Straight terminator along length"
        },
        "cube": {
            "examples": ["buildings", "boxes", "books", "furniture"],
            "light_pattern": "Distinct planes with different values",
            "critical_feature": "Three visible planes show different values"
        }
    }
    
    SPHERE_LIGHTING_ANATOMY = {
        "components": [
            "Highlight: Where light source directly hits (brightest point)",
            "Lit side: Gradual fall-off from highlight",
            "Terminator: Line where light/shadow meet (follows form curvature)",
            "Core shadow: Darkest part where light cannot reach",
            "Reflected light: Subtle bounce light from ground/surroundings",
            "Cast shadow: Shadow the sphere casts on ground (attached to object)"
        ],
        "temperature_rule": "Warm light = cool shadows, Cool light = warm shadows"
    }
    
    FORM_FOLLOWING_PRINCIPLE = {
        "rule": "Brushstrokes must follow the direction of the form",
        "applications": {
            "hair": "Strokes flow in direction of hair growth",
            "muscles": "Strokes follow muscle fiber direction",
            "fabric": "Strokes follow fold direction",
            "skin": "Strokes follow facial planes and contours"
        },
        "prohibition": "Never use random scribbling or directionless texture"
    }

# ============================================================================
# BRUSH TECHNIQUES
# ============================================================================

class BrushMastery:
    """Essential brush knowledge and settings"""
    
    ESSENTIAL_BRUSHES = {
        "hard_round": {
            "usage_percent": 75,
            "purposes": ["Initial blocking", "Sharp edges", "Details", "Definition"],
            "settings": {
                "hardness": "100%",
                "opacity_jitter": "Pen Pressure",
                "size_jitter": "Pen Pressure", 
                "spacing": "5-10%"
            }
        },
        "soft_round": {
            "usage_percent": 15,
            "purposes": ["Blending", "Atmosphere", "Background haze", "Soft shadows"],
            "settings": {
                "hardness": "0-50%",
                "opacity_jitter": "Pen Pressure (high)",
                "spacing": "10-25%"
            }
        },
        "textured_brush": {
            "usage_percent": 8,
            "purposes": ["Organic surfaces", "Skin texture", "Rock/ground", "Natural materials"],
            "settings": {
                "texture": "Enabled",
                "scattering": "Medium",
                "dual_brush": "Optional for complexity"
            }
        },
        "scatter_brush": {
            "usage_percent": 2,
            "purposes": ["Hair strands", "Grass", "Particles", "Foliage"],
            "settings": {
                "scattering": "High (50-150%)",
                "count_jitter": "Enabled",
                "spacing": "100-300%"
            }
        }
    }
    
    CRITICAL_SETTINGS = {
        "opacity_jitter_to_pen_pressure": {
            "importance": "MOST CRITICAL",
            "effect": "Light pressure = transparent, Heavy = opaque",
            "benefit": "Gradual value build-up, natural blending"
        },
        "size_jitter_to_pen_pressure": {
            "importance": "Secondary",
            "effect": "Creates natural stroke variation",
            "benefit": "Mimics real painting tools"
        },
        "shape_dynamics": {
            "angle_jitter": "For organic variation",
            "roundness_jitter": "Use sparingly - can be unpredictable"
        }
    }
    
    BRUSH_PHILOSOPHY = [
        "Time-saving brushes help with repetitive tasks",
        "Crutch brushes try to do the art for you (avoid)",
        "Skill and pressure control matter more than perfect brushes",
        "Master 2-3 brushes before adding more"
    ]

# ============================================================================
# HUMAN ANATOMY - FACE
# ============================================================================

class FacialAnatomy:
    """Painting human faces and features"""
    
    EYE_STRUCTURE = {
        "foundation": "Eye is a SPHERE with features wrapped around it",
        "components": {
            "eyeball": "Sphere - establish this form first",
            "iris": "Colored disk that wraps around sphere surface",
            "pupil": "Perfect circle centered on iris",
            "eyelids": "Have THICKNESS and wrap around sphere",
            "tear_duct": "3D form at inner corner"
        },
        "lighting": {
            "upper_lid_shadow": "Upper lid ALWAYS casts shadow on eyeball",
            "highlight": "Small, bright spot on wet surface (not centered on pupil)",
            "sclera": "NOT pure white - use cream, pink, yellow hints"
        },
        "common_mistakes": [
            "Making eyes too white (use subtle warm tones)",
            "Flat iris (remember it's on a sphere)",
            "Ignoring eyelid thickness (makes eyes look pasted on)",
            "Pupil off-center from iris",
            "Highlight too large or too centered"
        ]
    }
    
    EYE_PAINTING_PROCESS = [
        "1. Block the eyeball sphere with base shadow/light",
        "2. Add iris as colored disk (darker ring at outer edge)",
        "3. Add pupil (perfect black circle in exact center)",
        "4. Paint radiating color lines from pupil outward",
        "5. Add eyelids with proper thickness showing",
        "6. Shadow where upper lid meets eyeball",
        "7. Add highlight on wetness (small, bright, asymmetric)",
        "8. Subtle color variation in sclera (never pure white)"
    ]
    
    SKIN_COLOR_ZONES = {
        "principle": "Skin is NOT one color - it has temperature zones",
        "zones": {
            "forehead": "More YELLOW (less blood flow)",
            "cheeks": "More RED (blood concentration)",
            "nose_ears": "More RED (blood near surface)",
            "chin_jaw": "More BLUE/COOL (shadow areas)",
            "under_eyes": "PURPLE/VIOLET hints (thin skin, blood visible)"
        },
        "subsurface_scattering": "Red glow where light penetrates skin (ears, nose, fingers)"
    }
    
    SKIN_PAINTING_WORKFLOW = [
        "1. Base skin tone (middle value, neutral temperature)",
        "2. Core shadows (cooler, darker - blue/purple undertones)",
        "3. Highlights (warmer, lighter - yellow/orange undertones)",
        "4. Subsurface scattering (red glow in thin areas)",
        "5. Color zone variation (forehead yellow, cheeks red, etc.)",
        "6. Details LAST (pores, freckles) - never first",
        "7. Texture overlays (very subtle, low opacity)"
    ]
    
    HEAD_AS_FORM = {
        "structure": "Head is a sphere with face as flat plane on front",
        "approach": "Paint the skull and muscles underneath, revealed through lighting",
        "never": "Paint surface details without establishing underlying structure"
    }

# ============================================================================
# HAIR PAINTING
# ============================================================================

class HairTechniques:
    """Painting realistic hair"""
    
    HAIR_FUNDAMENTAL = "Hair is not individual strands - it's MASSES that flow together"
    
    HAIR_HIERARCHY = {
        "large_masses": {
            "percentage": 80,
            "description": "Big shapes painted with large brush",
            "purpose": "Overall form and flow direction"
        },
        "medium_detail": {
            "percentage": 15,
            "description": "Smaller clumps and separations",
            "purpose": "Break up masses, add interest"
        },
        "individual_strands": {
            "percentage": 5,
            "description": "Single hairs on edges only",
            "purpose": "Accent and believability"
        }
    }
    
    HAIR_PAINTING_SEQUENCE = [
        "1. Dark base color (shadows between hair masses)",
        "2. Mid-tone masses (follow direction of hair flow)",
        "3. Light masses (where light hits curved surfaces)",
        "4. Individual strands (ONLY on edges, very sparingly)",
        "5. Brightest highlights (peaks of hair curves only)"
    ]
    
    COLOR_VARIATION = {
        "blonde": ["yellow", "orange", "brown", "violet shadows"],
        "red": ["orange", "red", "brown", "cool reds in shadow"],
        "dark": ["blue-black", "brown-black", "warm highlights", "never pure black"],
        "principle": "Hair always has color variation - never solid color"
    }
    
    FLOW_DIRECTION = "Brushstrokes MUST follow hair growth direction - never random"

# ============================================================================
# CREATURE DESIGN
# ============================================================================

class CreatureDesign:
    """Creating believable creatures"""
    
    GOLDEN_RULE = "All creature designs come from mixing existing biology - study real animals first"
    
    PLAUSIBILITY_CHECKLIST = [
        "Can it actually move/function with this anatomy?",
        "How does it eat? (jaw structure, teeth type)",
        "How does it breathe? (nostrils, gills, spiracles?)",
        "What's its habitat? (adaptations must match)",
        "Predator or prey? (eyes forward or sides, teeth, claws)",
        "How does it reproduce?",
        "What's its role in ecosystem?"
    ]
    
    WEIGHT_DISTRIBUTION = {
        "small_creatures": "Thin limbs (gravity less impactful on small mass)",
        "large_creatures": "Thick, sturdy limbs (must support massive weight)",
        "rule": "ALWAYS consider physics and structural engineering"
    }
    
    DESIGN_PROCESS = [
        "1. Start with real animal skeleton as base",
        "2. Modify proportions with logical reason",
        "3. Add unique features with PURPOSE (not random)",
        "4. Give texture/color appropriate for environment",
        "5. Ask 'WHY?' for every design choice",
        "6. Test plausibility against checklist"
    ]
    
    ANATOMY_RULES = {
        "bones_define_shape": "Skeleton determines basic form",
        "muscles_create_surface": "Muscles create the surface forms and movement",
        "skin_wraps_structure": "Skin/scales/fur wraps around muscle and bone",
        "logic_required": "Every visible feature should have structural reason"
    }

# ============================================================================
# ATMOSPHERIC PERSPECTIVE
# ============================================================================

class AtmosphericPerspective:
    """Creating depth through atmosphere"""
    
    THREE_DEPTH_SYSTEM = {
        "foreground": {
            "contrast": "High contrast (full black to white possible)",
            "saturation": "Full saturation",
            "detail": "Sharp, crisp details",
            "color": "Full color range"
        },
        "midground": {
            "contrast": "Medium contrast (grays instead of blacks)",
            "saturation": "Medium saturation",
            "detail": "Less detail than foreground",
            "color": "Slightly faded toward atmosphere"
        },
        "background": {
            "contrast": "Low contrast (compressed values)",
            "saturation": "Low saturation (desaturated)",
            "detail": "Minimal detail (suggestions only)",
            "color": "Fades strongly toward sky color"
        }
    }
    
    HAZE_EFFECT = {
        "principle": "Objects fade toward the color of the atmosphere with distance",
        "earth": "Blue atmospheric haze",
        "mars": "Orange/red atmospheric haze",
        "custom": "Choose atmosphere color appropriate to world"
    }
    
    DEPTH_TECHNIQUE = [
        "1. Paint background at full saturation/contrast",
        "2. Add layer filled with sky/atmosphere color",
        "3. Set layer to Overlay or Soft Light",
        "4. Adjust opacity based on distance (farther = more opacity)",
        "5. Repeat for different depth zones"
    ]

# ============================================================================
# WEATHER AND LIGHTING
# ============================================================================

class WeatherAndLight:
    """Weather conditions and their visual characteristics"""
    
    WEATHER_COLOR_TEMPERATURES = {
        "sunny": {
            "palette": ["warm yellows", "oranges", "golden tones"],
            "shadows": "Strong, dark, crisp edges",
            "contrast": "High",
            "atmosphere": "Clear, high saturation"
        },
        "rainy": {
            "palette": ["cool blues", "grays", "desaturated"],
            "shadows": "Soft, diffused",
            "contrast": "Low",
            "atmosphere": "Wet surfaces reflect light"
        },
        "overcast": {
            "palette": ["neutral grays", "desaturated colors"],
            "shadows": "Almost nonexistent (diffused light from all directions)",
            "contrast": "Very low",
            "atmosphere": "Flat, even lighting"
        },
        "foggy": {
            "palette": ["desaturated everything", "white/gray dominant"],
            "shadows": "Extremely soft or absent",
            "contrast": "Almost none (objects fade quickly with distance)",
            "atmosphere": "Limited visibility, objects disappear"
        },
        "snow": {
            "palette": ["cool overall", "blue shadows", "white highlights"],
            "shadows": "Blue from reflected sky",
            "contrast": "High between snow and objects",
            "atmosphere": "Bright, reflective ground plane"
        }
    }
    
    LIGHT_TEMPERATURE_RULE = {
        "warm_light": "Creates cool (blue/purple) shadows",
        "cool_light": "Creates warm (orange/yellow) shadows",
        "reason": "Physics - light bounces and reflects from surroundings"
    }

# ============================================================================
# COLOR THEORY
# ============================================================================

class ColorTheory:
    """Color relationships and application"""
    
    FUNDAMENTAL_RELATIONSHIPS = {
        "warm_vs_cool": "Warm light creates cool shadows, cool light creates warm shadows",
        "complementary": "Opposite colors create strongest contrast (blue/orange, red/green)",
        "analogous": "Adjacent colors create harmony (blue, blue-green, green)",
        "temperature_depth": "Cool colors recede, warm colors advance"
    }
    
    LIMITED_PALETTE_APPROACH = {
        "philosophy": "Master painters use 5-7 colors total, beginners use 50 and get mud",
        "starter_palette": {
            "warm_light": "Yellow ochre",
            "cool_shadow": "Ultramarine blue",
            "skin_base": "Burnt sienna",
            "accent": "Cadmium red",
            "neutrals": ["Ivory black", "Titanium white"]
        },
        "benefit": "Forces color mixing skill, creates harmony automatically"
    }
    
    COLOR_LAYER_TECHNIQUE = [
        "1. Paint entire image in perfect grayscale values",
        "2. Add new layer set to COLOR blend mode",
        "3. Paint colors over the grayscale layer",
        "4. Values remain correct (from grayscale), color adds mood",
        "5. Easy to adjust color without affecting form"
    ]
    
    COLOR_PSYCHOLOGY = {
        "red": "Energy, passion, danger, warmth",
        "blue": "Calm, cold, sadness, distance",
        "yellow": "Joy, energy, warmth, sickness",
        "green": "Nature, growth, envy, poison",
        "purple": "Royalty, mystery, magic, shadow",
        "orange": "Energy, warmth, autumn, fire"
    }

# ============================================================================
# COMPLETE WORKFLOW
# ============================================================================

class WorkflowSystem:
    """Professional painting workflow"""
    
    TIME_ALLOCATION = {
        "concept": {
            "percentage": 5,
            "activities": ["Thumbnail sketches", "Value studies", "Reference gathering", "Composition planning"]
        },
        "structure": {
            "percentage": 15,
            "activities": ["Block major shapes", "Establish values", "Check composition", "Verify proportions"]
        },
        "development": {
            "percentage": 60,
            "activities": ["Refine forms", "Add progressive detail", "Work large-to-small", "Build up layers"]
        },
        "polish": {
            "percentage": 20,
            "activities": ["Sharpen focal points", "Add final texture", "Color correction", "Final highlights"]
        }
    }
    
    CRITICAL_HABITS = [
        "Flip image horizontally frequently (reveals errors)",
        "Take regular breaks (fresh eyes catch mistakes)",
        "Work zoomed OUT at 25% view (prevents noodling)",
        "Only zoom in for specific details",
        "Save progression frequently (create save points)",
        "Check composition in thumbnail size",
        "Squint to check value structure",
        "Never be afraid to restart if foundation is wrong"
    ]
    
    LAYER_ORGANIZATION = {
        "bottom": "Background elements",
        "middle": "Main subject layers",
        "top": "Details, highlights, effects",
        "adjustment_layers": "Color correction, levels, curves (non-destructive)",
        "naming": "Always name layers descriptively (not 'Layer 1, Layer 2')"
    }

# ============================================================================
# COMMON MISTAKES TO AVOID
# ============================================================================

COMMON_MISTAKES = {
    "value_errors": [
        "Too many values (creates mud) - limit to 3-5 groups",
        "Not enough contrast (image reads flat)",
        "Forgetting atmospheric perspective (everything same contrast)",
        "Adding color before values are correct"
    ],
    
    "form_errors": [
        "Details before form (putting details on flat shapes)",
        "Ignoring light source (shadows going multiple directions)",
        "Not following form with brushstrokes (random scribbling)",
        "Forgetting basic geometry (everything should reduce to sphere/cylinder/cube)"
    ],
    
    "color_errors": [
        "Using too many colors (creates chaos)",
        "Pure black for shadows (use dark blues, purples instead)",
        "Pure white for highlights (use cream, light yellow)",
        "Ignoring color temperature (no warm/cool variation)",
        "Oversaturating (less is more)"
    ],
    
    "technical_errors": [
        "Working too zoomed in (lose sight of whole)",
        "Never flipping image (can't see errors)",
        "Not taking breaks (eye fatigue blinds you to mistakes)",
        "Too many brushes (skill matters more than tools)",
        "Overusing filters/effects (crutch instead of skill)"
    ],
    
    "anatomical_errors": [
        "Eyes too white (use subtle warm tones)",
        "Flat skin (one color instead of color zones)",
        "Symbol drawing (drawing idea of eye instead of real eye structure)",
        "Ignoring skull structure under skin",
        "Hair as strands instead of masses"
    ]
}

# ============================================================================
# PRACTICE CURRICULUM
# ============================================================================

PRACTICE_CURRICULUM = {
    "week_1_2": {
        "focus": "Value Studies",
        "exercises": [
            "Paint 20 spheres with different lighting angles",
            "10 still life objects in grayscale only",
            "5 simple portraits (grayscale, focus on value structure)",
            "Daily: Draw basic forms (cubes, cylinders, cones)"
        ]
    },
    
    "week_3_4": {
        "focus": "Form & Structure",
        "exercises": [
            "10 skull studies from different angles",
            "10 eye studies (focus on sphere structure)",
            "5 full face constructions (block in basic forms)",
            "Study real anatomy (skeleton, muscles)"
        ]
    },
    
    "week_5_6": {
        "focus": "Color Introduction",
        "exercises": [
            "Repaint grayscale studies with color layers",
            "10 color sphere studies (practice temperature)",
            "5 portraits with LIMITED palette (5 colors max)",
            "Study color relationships in master paintings"
        ]
    },
    
    "week_7_8": {
        "focus": "Creatures",
        "exercises": [
            "20 creature thumbnails from animal mashups",
            "5 detailed creature paintings",
            "Design 3 original species with plausibility",
            "Study animal anatomy (skeletal structure)"
        ]
    },
    
    "week_9_10": {
        "focus": "Environments",
        "exercises": [
            "10 landscape value studies",
            "5 weather condition paintings (sunny, rainy, foggy, etc.)",
            "3 complete environment illustrations",
            "Study atmospheric perspective in photos"
        ]
    },
    
    "week_11_12": {
        "focus": "Integration",
        "exercises": [
            "3 complete narrative illustrations (story in image)",
            "Combine figures + environments",
            "Create portfolio pieces using all learned techniques",
            "Review and identify weak areas for continued practice"
        ]
    }
}

# ============================================================================
# MASTER ARTIST WISDOM
# ============================================================================

MASTER_QUOTES = {
    "daarken": [
        "Work on a painting until it looks right, not until you've spent X hours on it",
        "The best way to learn is to paint every single day",
        "If you're bored while painting, the viewer will be bored looking at it"
    ],
    
    "carlos_cabrera": [
        "Observation is the foundation of art - study reality before creating fantasy",
        "Weather conditions are defined by specific color temperatures and contrast levels"
    ],
    
    "richard_tilbury": [
        "Understanding anatomy means understanding the forms beneath the surface",
        "Every mark you make should have a reason"
    ],
    
    "mike_corriero": [
        "Study real animals before designing creatures - nature is the best designer",
        "All believable creature designs follow physics and biology"
    ],
    
    "anne_pogoda": [
        "Hair is masses, not strands - paint 80% with big brush",
        "Individual hairs are accents, not the foundation"
    ],
    
    "melanie_delon": [
        "I use 3 brushes for everything - it's about control, not tools",
        "Skin has temperature zones - study them, don't guess"
    ],
    
    "marc_brunet": [
        "A good brush saves time on repetitive tasks",
        "A crutch brush tries to do the art for you - avoid it"
    ]
}

# ============================================================================
# REFERENCE AND STUDY GUIDELINES
# ============================================================================

REFERENCE_GUIDELINES = {
    "when_to_use": [
        "Always for anatomy (no one knows perfectly from memory)",
        "For specific poses or expressions",
        "For materials/textures you're unfamiliar with",
        "For lighting scenarios",
        "For period costumes, vehicles, architecture"
    ],
    
    "how_to_use": [
        "Study to understand, don't copy mindlessly",
        "Use multiple references, combine elements",
        "Focus on understanding structure, not just copying surface",
        "Take own photos when possible (no copyright issues)",
        "Build personal reference library organized by subject"
    ],
    
    "what_to_study": {
        "anatomy": ["Skeleton", "Major muscle groups", "Proportions", "Range of motion"],
        "light": ["Time of day", "Weather conditions", "Indoor vs outdoor", "Multiple sources"],
        "materials": ["How light behaves on different surfaces", "Texture characteristics"],
        "composition": ["Analyze master paintings", "Photography composition", "Film shots"]
    }
}

# ============================================================================
# FINAL WISDOM
# ============================================================================

FINAL_PRINCIPLES = {
    "hierarchy_of_learning": [
        "1. VALUE - Master light and shadow first",
        "2. FORM - Understand 3D structure",
        "3. ANATOMY - Study real structure",
        "4. COLOR - Add color after mastering above",
        "5. STYLE - Emerges naturally, never forced"
    ],
    
    "daily_practice": [
        "Draw/paint EVERY day (even 15 minutes)",
        "Study from life when possible",
        "Analyze master artworks",
        "Share work for feedback",
        "Never stop learning"
    ],
    
    "mindset": [
        "Skill comes from consistent practice, not talent",
        "Mistakes are teachers - learn from them",
        "Compare to your past self, not to others",
        "Understanding beats technique every time",
        "Art is communication - make intentional choices"
    ]
}

# ============================================================================
# AURORA'S WORKING CHECKLIST
# ============================================================================

def aurora_pre_painting_checklist():
    """
    Checklist to review before starting any artwork
    """
    checklist = {
        "concept_phase": [
            "□ Is the idea clear? Can I describe it in one sentence?",
            "□ What emotion/story am I trying to convey?",
            "□ Have I gathered necessary references?",
            "□ Did I do thumbnail value studies?",
            "□ Is composition planned (focal point, flow, balance)?"
        ],
        
        "execution_phase": [
            "□ Am I working in grayscale first to establish values?",
            "□ Have I blocked in basic forms (sphere, cylinder, cube)?",
            "□ Is my light source consistent?",
            "□ Are my shadows going the correct direction?",
            "□ Am I working large-to-small (general to specific)?",
            "□ Am I viewing at 25% to check overall read?",
            "□ Have I flipped the image to check for errors?"
        ],
        
        "refinement_phase": [
            "□ Do values group into clear zones (3-5 distinct groups)?",
            "□ Is atmospheric perspective applied (depth through value/saturation)?",
            "□ Are brushstrokes following form direction?",
            "□ Is the focal point the sharpest/highest contrast area?",
            "□ Have I limited my color palette (5-7 colors max)?",
            "□ Are warm/cool temperatures balanced?",
            "□ Did I take breaks to return with fresh eyes?"
        ],
        
        "final_phase": [
            "□ Does it read clearly as thumbnail?",
            "□ Is composition balanced but not symmetrical?",
            "□ Are edges varied (hard, soft, lost)?",
            "□ Do details support the focal point (not distract)?",
            "□ Is the story/emotion clear?",
            "□ Would I be proud to show this?"
        ]
    }
    
    return checklist

def get_technique_for_subject(subject):
    """
    Quick reference: what technique to use for specific subjects
    """
    techniques = {
        "portrait": ["VALUE first grayscale", "Sphere for head", "Skin color zones", "Eyes as spheres"],
        "creature": ["Real animal anatomy base", "Plausibility checklist", "Form follows function"],
        "environment": ["Atmospheric perspective", "Three depth zones", "Weather color temperature"],
        "hair": ["Masses not strands", "80/15/5 hierarchy", "Flow direction"],
        "eyes": ["Sphere base", "Eyelid thickness", "Upper lid shadow", "Wet highlight"],
        "clothing": ["Folds follow form", "Fabric weight affects folds", "Gravity pulls down"],
        "metal": ["High contrast", "Sharp highlights", "Reflections of environment"],
        "skin": ["Color zones", "Subsurface scattering", "Never pure white/black"]
    }
    
    return techniques.get(subject.lower(), ["Study fundamentals first"])

# ============================================================================
# END OF AURORA'S ART BRAIN
# ============================================================================

"""
USAGE NOTES FOR AURORA:

This knowledge base should be consulted when:
1. Starting any new artwork
2. Encountering difficulties with specific subjects
3. Reviewing completed work for areas of improvement
4. Planning practice sessions
5. Making artistic decisions

Remember: UNDERSTANDING > TECHNIQUE
The 'why' matters more than the 'how'

All principles here come from professional digital artists with years of experience.
They've made the mistakes so you don't have to.

Study this, apply it, and your art will improve dramatically.

- Synthesized with care for Aurora's artistic growth
"""
