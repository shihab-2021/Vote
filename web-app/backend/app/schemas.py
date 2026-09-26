from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    username: str
    password: str


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    key: str
    label: str


class AreaScopeIn(BaseModel):
    scope_field: str  # upazila | union_name | ward | area_no | area_name
    scope_value: str


class AreaScopeOut(AreaScopeIn):
    id: int


class UserOut(BaseModel):
    """auth.serialize_user()-এর তৈরি dict থেকে ভ্যালিডেট হয় -- role/permissions/area_scopes
    জয়েন করে হিসেব করা হয় বলে সরাসরি ORM অবজেক্ট ম্যাপিং (from_attributes) ব্যবহার হয় না।"""
    id: int
    username: str
    role: str
    role_label: str
    is_active: bool
    permissions: list[str]
    area_scopes: list[AreaScopeOut] = []
    candidate_id: int | None = None
    created_at: datetime
    last_login_at: datetime | None = None


class UserCreate(BaseModel):
    username: str
    password: str
    # candidate-actর নিজের এজেন্ট তৈরি করলে None রাখা যায় -- ব্যাকএন্ড তখন candidate_agent
    # রোল জোর করে বসিয়ে দেয়; বাকি সবার জন্য (super_admin/manage_users) আবশ্যক
    role_id: int | None = None
    area_scopes: list[AreaScopeIn] = []
    # শুধু super_admin/manage_users ব্যবহারকারীরা সেট করতে পারেন (candidate/candidate_agent
    # ইউজারের জন্য কোন প্রার্থীর সাথে যুক্ত করতে হবে) -- একজন candidate অ্যাক্টর নিজে এজেন্ট
    # তৈরি করলে এই ভ্যালু নির্বিশেষে নিজের candidate_id দিয়ে জোর করে বদলে দেওয়া হয়
    candidate_id: int | None = None


class UserUpdate(BaseModel):
    """সব ফিল্ড ঐচ্ছিক -- শুধু যা পাঠানো হবে তা আপডেট হবে। area_scopes দিলে পুরনো সব স্কোপ
    প্রতিস্থাপিত হবে (আংশিক আপডেট না)।"""
    role_id: int | None = None
    is_active: bool | None = None
    password: str | None = None
    area_scopes: list[AreaScopeIn] | None = None
    candidate_id: int | None = None


class CandidateBase(BaseModel):
    name: str
    constituency_label: str | None = None
    symbol_name: str | None = None
    slogan: str | None = None
    primary_color: str | None = None
    accent_color: str | None = None


class CandidateCreate(CandidateBase):
    pass


class CandidateUpdate(BaseModel):
    """সব ফিল্ড ঐচ্ছিক। candidate নিজে PATCH /candidates/me দিয়ে এটাই ব্যবহার করেন (name বাদে
    সবকিছু নিজে বদলাতে পারেন), super_admin PATCH /candidates/{id} দিয়ে name/is_active সহ সব।"""
    name: str | None = None
    constituency_label: str | None = None
    symbol_name: str | None = None
    slogan: str | None = None
    primary_color: str | None = None
    accent_color: str | None = None
    is_active: bool | None = None


class CandidateOut(CandidateBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool
    has_symbol_image: bool = False
    has_photo_image: bool = False
    created_at: datetime


VOTER_CORE_FIELDS = [
    "serial_no", "name", "voter_no", "father_name", "mother_name", "occupation",
    "dob", "gender", "district", "municipality", "upazila", "union_name", "ward",
    "area_no", "area_name", "address", "upazila_folder", "union_folder",
    "area_folder", "source_file",
]


class VoterBase(BaseModel):
    serial_no: str | None = None
    name: str
    voter_no: str | None = None
    father_name: str | None = None
    mother_name: str | None = None
    occupation: str | None = None
    dob: str | None = None
    gender: str | None = None
    district: str | None = None
    municipality: str | None = None
    upazila: str | None = None
    union_name: str | None = None
    ward: str | None = None
    area_no: str | None = None
    area_name: str | None = None
    address: str | None = None
    upazila_folder: str | None = None
    union_folder: str | None = None
    area_folder: str | None = None
    source_file: str | None = None
    extra_fields: dict = {}


class VoterCreate(VoterBase):
    pass


class VoterUpdate(BaseModel):
    """সব ফিল্ড ঐচ্ছিক -- শুধু যা পাঠানো হবে তা আপডেট হবে"""
    serial_no: str | None = None
    name: str | None = None
    voter_no: str | None = None
    father_name: str | None = None
    mother_name: str | None = None
    occupation: str | None = None
    dob: str | None = None
    gender: str | None = None
    district: str | None = None
    municipality: str | None = None
    upazila: str | None = None
    union_name: str | None = None
    ward: str | None = None
    area_no: str | None = None
    area_name: str | None = None
    address: str | None = None
    extra_fields: dict | None = None


class VoterOut(VoterBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    flag_reasons: list[str]
    is_flagged: bool
    import_batch_id: int | None
    created_at: datetime
    updated_at: datetime


class VoterListResponse(BaseModel):
    items: list[VoterOut]
    total: int
    page: int
    page_size: int


class FieldDefCreate(BaseModel):
    key: str
    label: str
    field_type: str = "text"
    options: dict | list | None = None


class FieldDefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    key: str
    label: str
    field_type: str
    options: dict | list | None


class ImportBatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    imported_at: datetime
    row_count: int
    inserted_count: int
    updated_count: int
    error_count: int
    status: str


class ImportResult(BaseModel):
    import_batch_id: int
    inserted: int
    updated: int
    errors: int
    total_rows: int


class StatsSummary(BaseModel):
    total_voters: int
    flagged_count: int
    by_ward: dict[str, int]
    by_upazila: dict[str, int]
    by_gender: dict[str, int]
