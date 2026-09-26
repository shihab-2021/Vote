from datetime import datetime

from sqlalchemy import (
    ARRAY, Boolean, Computed, DateTime, ForeignKey, Integer, BigInteger,
    LargeBinary, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(64), nullable=False)

    permissions: Mapped[list["Permission"]] = relationship(secondary="role_permissions")


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(64), nullable=False)


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), primary_key=True)
    permission_id: Mapped[int] = mapped_column(ForeignKey("permissions.id"), primary_key=True)


class UserAreaScope(Base):
    """একজন ব্যবহারকারী কোন ভৌগোলিক এলাকার ভোটার ডেটা দেখতে পারবেন তার তালিকা -- একাধিক সারি
    OR হিসেবে মেলানো হয়। super_admin-এর জন্য কোনো স্কোপ লাগে না (সব দেখতে পান)। scope_field
    Voter মডেলের বিদ্যমান ভৌগোলিক কলামগুলোর একটা (upazila/union_name/ward/area_no/area_name)।"""
    __tablename__ = "user_area_scopes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    scope_field: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_value: Mapped[str] = mapped_column(Text, nullable=False)


class Candidate(Base):
    """একজন নির্বাচনী প্রার্থীর ব্র্যান্ডিং প্রোফাইল -- প্রতীক/ছবি/স্লোগান/রঙ, যা দিয়ে তার ও তার
    এজেন্টদের তৈরি প্রিন্ট-ব্যাচের ভোটার স্লিপ কাস্টমাইজড হয়। এলাকা-সীমাবদ্ধতা এখানে নেই -- সেটা
    বিদ্যমান user_area_scopes দিয়েই হয় (এই প্রার্থীর লগইন ইউজারের স্কোপ হিসেবে), এটা শুধু
    ব্র্যান্ডিং-মালিকানার তথ্য রাখে। ছবি bytea হিসেবে রাখা হয়েছে যাতে হোস্টিং ডিস্ক পার্সিস্টেন্ট
    না হলেও রিডিপ্লয়ে আপলোড হারিয়ে না যায়।"""
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    constituency_label: Mapped[str | None] = mapped_column(Text, nullable=True)
    symbol_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    symbol_image: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    photo_image: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    slogan: Mapped[str | None] = mapped_column(Text, nullable=True)
    primary_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    accent_color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    candidate_id: Mapped[int | None] = mapped_column(ForeignKey("candidates.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    role: Mapped["Role"] = relationship()
    area_scopes: Mapped[list["UserAreaScope"]] = relationship()
    # candidates.created_by-ও users.id-কে রেফার করে, তাই এই দুই টেবিলের মধ্যে একাধিক FK পথ
    # আছে -- foreign_keys না দিলে SQLAlchemy কোনটা ব্যবহার করবে বুঝতে পারে না (AmbiguousForeignKeysError)
    candidate: Mapped["Candidate | None"] = relationship(foreign_keys=[candidate_id])


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    imported_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    inserted_count: Mapped[int] = mapped_column(Integer, default=0)
    updated_count: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="processing")  # processing | done | failed


class CustomFieldDef(Base):
    __tablename__ = "custom_field_defs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    field_type: Mapped[str] = mapped_column(String(16), default="text")  # text|number|date|boolean|select
    options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Voter(Base):
    __tablename__ = "voters"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)

    serial_no: Mapped[str | None] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    voter_no: Mapped[str | None] = mapped_column(Text)
    father_name: Mapped[str | None] = mapped_column(Text)
    mother_name: Mapped[str | None] = mapped_column(Text)
    occupation: Mapped[str | None] = mapped_column(Text)
    dob: Mapped[str | None] = mapped_column(Text)
    gender: Mapped[str | None] = mapped_column(Text)
    district: Mapped[str | None] = mapped_column(Text)
    municipality: Mapped[str | None] = mapped_column(Text)
    upazila: Mapped[str | None] = mapped_column(Text)
    union_name: Mapped[str | None] = mapped_column(Text)
    ward: Mapped[str | None] = mapped_column(Text)
    area_no: Mapped[str | None] = mapped_column(Text)
    area_name: Mapped[str | None] = mapped_column(Text)
    address: Mapped[str | None] = mapped_column(Text)
    upazila_folder: Mapped[str | None] = mapped_column(Text)
    union_folder: Mapped[str | None] = mapped_column(Text)
    area_folder: Mapped[str | None] = mapped_column(Text)
    source_file: Mapped[str | None] = mapped_column(Text)

    flag_reasons: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    is_flagged: Mapped[bool] = mapped_column(
        Boolean, Computed("cardinality(flag_reasons) > 0", persisted=True), nullable=False
    )
    extra_fields: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    import_batch_id: Mapped[int | None] = mapped_column(ForeignKey("import_batches.id"), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PrintBatch(Base):
    """একটা "প্রিন্ট ব্যাচ" -- ফিল্টার করা ভোটারদের একটা স্ন্যাপশট, যাদের কার্ড একসাথে তৈরি/প্রিন্ট
    করা হয়। voter_count ব্যাচ তৈরির সময়ের সংখ্যা -- পরে ভোটার ডেটা বদলালেও এই সংখ্যা বদলায় না।"""
    __tablename__ = "print_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    label: Mapped[str] = mapped_column(Text, nullable=False)
    voter_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    printed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    candidate_id: Mapped[int | None] = mapped_column(ForeignKey("candidates.id"), nullable=True)

    items: Mapped[list["PrintBatchItem"]] = relationship(back_populates="batch")
    candidate: Mapped["Candidate | None"] = relationship()


class PrintBatchItem(Base):
    """একটা ব্যাচের একটা ভোটার-এন্ট্রি ও তার প্রিন্ট/বিতরণ অবস্থা। একই ভোটার একাধিক ব্যাচে
    (রিপ্রিন্ট) থাকতে পারেন, তাই voters টেবিলে কলাম না রেখে আলাদা জয়েন-টেবিল।"""
    __tablename__ = "print_batch_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("print_batches.id"), nullable=False)
    voter_id: Mapped[int] = mapped_column(ForeignKey("voters.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")  # pending|printed|distributed
    distributed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    batch: Mapped["PrintBatch"] = relationship(back_populates="items")
    voter: Mapped["Voter"] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    voter_id: Mapped[int | None] = mapped_column(ForeignKey("voters.id"), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    field: Mapped[str | None] = mapped_column(Text)
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ActivityLog(Base):
    """সিস্টেম-ব্যাপী কার্যক্রমের লগ (লগইন, ইউজার/রোল পরিবর্তন, এক্সপোর্ট, প্রিন্ট, ইমপোর্ট) --
    উপরের AuditLog থেকে আলাদা, যেটা শুধু একটা ভোটার রেকর্ডের ফিল্ড-লেভেল পরিবর্তন ট্র্যাক করে।"""
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    detail: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
