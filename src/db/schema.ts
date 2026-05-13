export type OrgStatus = 'pending' | 'approved' | 'rejected'
export type EinStatus = 'pending' | 'verified' | 'failed' | 'manual_review'

export type Org = {
  id: string
  email: string
  password_hash: string
  name: string
  ein: string | null
  ein_status: EinStatus
  status: OrgStatus
  created_at: number
}

export type StaffVerificationStatus =
  | 'auto_verified'
  | 'pending_manual'
  | 'approved'
  | 'rejected'

export type SchoolStaffAccount = {
  id: string
  email: string
  password_hash: string
  name: string
  school_name: string
  email_domain: string
  verification_status: StaffVerificationStatus
  created_at: number
}

export type Admin = {
  id: string
  email: string
  password_hash: string
  name: string
  created_at: number
}

export type ListingStatus = 'pending' | 'approved' | 'rejected'
export type ListingType = 'shift' | 'project'
export type PosterType = 'org' | 'school_staff'

export type Listing = {
  id: string
  title: string
  description: string
  category: string
  listing_type: ListingType
  location: string
  image_key: string | null
  status: ListingStatus
  poster_type: PosterType
  org_id: string | null
  school_staff_id: string | null
  created_at: number
  updated_at: number
}

export type Inquiry = {
  id: string
  listing_id: string
  student_email: string
  student_name: string
  message: string
  verified: 0 | 1
  created_at: number
}

export type RegisteredDomain = {
  id: string
  domain: string
  school_name: string
  created_at: number
}
