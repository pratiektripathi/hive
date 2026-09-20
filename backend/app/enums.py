from enum import Enum


class ThemeEnum(str, Enum):
    light = "light"
    dark = "dark"


class ImportMethodEnum(str, Enum):
    parser = "parser"
    ai = "ai"
    hybrid = "hybrid"
    sample = "sample"
    manual = "manual"


class ImportStatusEnum(str, Enum):
    success = "success"
    partial = "partial"
    failed = "failed"


class CommentTypeEnum(str, Enum):
    info = "info"
    limit = "limit"
    defect = "defect"


class CommentCategoryEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    # Legacy alias kept for reading older rows
    med = "med"


class AnswerTypeEnum(str, Enum):
    text = "text"
    checkbox = "checkbox"
    date = "date"
    number = "number"
    multiple = "multiple"
    signature = "signature"
    numeric_range = "numeric-range"
    # Legacy import values
    range = "range"
    boolean = "boolean"


class RecommendationEnum(str, Enum):
    no_recommendation = "No Recommendation"
    appliance_repair = "Appliance Repair"
    builder = "Builder"
    cabinet_contractor = "Cabinet Contractor"
    carpentry_contractor = "Carpentry Contractor"
    carpet_cleaner = "Carpet Cleaner"
    chimney_repair_contractor = "Chimney Repair Contractor"
    chimney_sweep = "Chimney Sweep"
    cleaning_service = "Cleaning Service"
    concrete_contractor = "Concrete Contractor"
    countertop_contractor = "Countertop Contractor"
    deck_contractor = "Deck Contractor"
    diy = "DIY"
    door_repair_and_installation_contractor = "Door Repair and Installation Contractor"
    driveway_contractor = "Driveway Contractor"
    drywall_contractor = "Drywall Contractor"
    electrical_contractor = "Electrical Contractor"
    environmental_contractor = "Environmental Contractor"
    fence_contractor = "Fence Contractor"
    fireplace_contractor = "Fireplace Contractor"
    fire_suppression_contractor = "Fire Suppression Contractor"
    flooring_contractor = "Flooring Contractor"
    foundation_contractor = "Foundation Contractor"
    garage_door_contractor = "Garage Door Contractor"
    general_contractor = "General Contractor"
    grading_contractor = "Grading Contractor"
    gutter_contractor = "Gutter Contractor"
    handyman = "Handyman"
    handyman_diy = "Handyman/DIY"
    heating_and_cooling_contractor = "Heating and Cooling Contractor"
    home_energy_contractor = "Home Energy Contractor"
    homeowners_association = "Homeowners Association"
    hvac_professional = "HVAC Professional"
    inquire_with_seller = "Inquire With Seller"
    insulation_contractor = "Insulation Contractor"
    landscaping_contractor = "Landscaping Contractor"
    lawncare_professional = "Lawncare Professional"
    masonry_concrete_brick_stone = "Masonry, Concrete, Brick & Stone"
    masonry_contractor = "Masonry Contractor"
    masonry_restoration_contractor = "Masonry Restoration Contractor"
    mold_inspector = "Mold Inspector"
    mold_remediation_contractor = "Mold Remediation Contractor"
    monitor = "Monitor"
    painting_contractor = "Painting Contractor"
    pest_control_pro = "Pest Control Pro"
    plumbing_contractor = "Plumbing Contractor"
    professional_engineer = "Professional Engineer"
    professional_locksmith = "Professional Locksmith"
    qualified_professional = "Qualified Professional"
    radon_mitigation_specialist = "Radon Mitigation Specialist"
    roofing_professional = "Roofing Professional"
    septic_system_contractor = "Septic System Contractor"
    sheet_metal_contractor = "Sheet Metal Contractor"
    siding_contractor = "Siding Contractor"
    solar_panel_contractor = "Solar Panel Contractor"
    structural_engineer = "Structural Engineer"
    stucco_repair_contractor = "Stucco Repair Contractor"
    swimming_pool_spa_contractor = "Swimming Pool / Spa Contractor"
    tile_contractor = "Tile Contractor"
    tree_service = "Tree Service"
    utility_company = "Utility Company"
    waterproofing_contractor = "Waterproofing Contractor"
    well_service_contractor = "Well Service Contractor"
    window_repair_and_installation_contractor = "Window Repair and Installation Contractor"


class WarningSeverityEnum(str, Enum):
    info = "info"
    warning = "warning"
    error = "error"


class DetectedTypeEnum(str, Enum):
    section = "section"
    item = "item"
    comment = "comment"
    unknown = "unknown"


class ValidationStatusEnum(str, Enum):
    valid = "valid"
    malformed = "malformed"
    partial = "partial"
    rejected = "rejected"
    unavailable = "unavailable"
