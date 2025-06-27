import { supabase } from "./supabase"

export async function signUp(email: string, password: string, fullName: string, referralCode?: string) {
  // First, sign up the user with Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: undefined, // Disable email confirmation
    },
  })

  if (error) throw error

  if (data.user) {
    // Get referrer ID if referral code provided
    let referrerId: string | null = null
    if (referralCode) {
      referrerId = await getReferrerByCode(referralCode)
    }

    // Create user profile in our users table
    const { error: profileError } = await supabase.from("users").insert({
      id: data.user.id,
      email,
      full_name: fullName,
      referred_by: referrerId,
    })

    if (profileError) {
      console.error("Profile creation error:", profileError)
      throw new Error("Failed to create user profile")
    }

    // Process referral reward if applicable
    if (referralCode && referrerId) {
      try {
        const { error: referralError } = await supabase.rpc("process_referral_reward", {
          referrer_uuid: referrerId,
          referred_uuid: data.user.id,
        })

        if (referralError) {
          console.error("Referral processing error:", referralError)
          // Don't throw error here - user is created, just referral bonus failed
        }
      } catch (err) {
        console.error("Referral reward processing failed:", err)
      }
    }
  }

  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

async function getReferrerByCode(code: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.from("users").select("id").eq("referral_code", code).single()

    if (error || !data) {
      console.error("Referrer lookup error:", error)
      return null
    }

    return data.id
  } catch (err) {
    console.error("Error finding referrer:", err)
    return null
  }
}
