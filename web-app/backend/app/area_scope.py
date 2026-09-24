# -*- coding: utf-8 -*-
"""ভৌগোলিক এলাকা-ভিত্তিক ডেটা-অ্যাক্সেস স্কোপিং। list_voters, export, stats -- সবগুলোতে
একইভাবে ব্যবহৃত হয়, যাতে যেকোনো ভোটার-ডেটা কুয়েরিতে ব্যবহারকারীর এলাকা-সীমাবদ্ধতা সবসময় প্রযোজ্য হয়।"""
from sqlalchemy import false, or_, select
from sqlalchemy.orm import Session

from .models import User, UserAreaScope, Voter

SCOPE_COLUMNS = {
    "upazila": Voter.upazila,
    "union_name": Voter.union_name,
    "ward": Voter.ward,
    "area_no": Voter.area_no,
    "area_name": Voter.area_name,
}


def apply_area_scope(query, user: User, db: Session):
    """super_admin সব ডেটা দেখতে পান -- এই ফাংশন সেক্ষেত্রে কুয়েরি অপরিবর্তিত রাখে। বাকি সবার
    জন্য user_area_scopes-এ থাকা শর্তগুলো OR করে ফিল্টার করা হয়। কোনো স্কোপ না থাকলে নিরাপদ
    ডিফল্ট হিসেবে কোনো ডেটাই দেখানো হয় না -- ভুলবশত সব ডেটা উন্মুক্ত হয়ে যাওয়া এড়াতে।"""
    if user.role.key == "super_admin":
        return query

    scopes = db.scalars(select(UserAreaScope).where(UserAreaScope.user_id == user.id)).all()
    conditions = [
        SCOPE_COLUMNS[s.scope_field] == s.scope_value
        for s in scopes if s.scope_field in SCOPE_COLUMNS
    ]
    if not conditions:
        return query.where(false())
    return query.where(or_(*conditions))
