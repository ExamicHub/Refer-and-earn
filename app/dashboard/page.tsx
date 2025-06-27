"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DollarSign, Users, Share2, Copy, LogOut, Wallet, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { signOut } from "@/lib/auth"
import WithdrawModal from "@/components/withdraw-modal"

interface UserData {
  id: string
  email: string
  full_name: string
  referral_code: string
  total_earnings: number
  available_balance: number
  total_referrals: number
}

interface Referral {
  id: string
  referred_id: string
  reward_amount: number
  created_at: string
  users: {
    full_name: string
    email: string
  }
}

interface Withdrawal {
  id: string
  amount: number
  status: string
  requested_at: string
  processed_at: string | null
  admin_notes: string | null
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!authUser) {
        router.push("/auth/login")
        return
      }

      await Promise.all([fetchUserData(authUser.id), fetchReferrals(authUser.id), fetchWithdrawals(authUser.id)])

      setLoading(false)
    } catch (err: any) {
      console.error("Auth check error:", err)
      setError("Failed to load dashboard. Please try refreshing the page.")
      setLoading(false)
    }
  }

  const fetchUserData = async (userId: string) => {
    try {
      const { data, error } = await supabase.from("users").select("*").eq("id", userId).single()

      if (error) throw error
      if (data) setUser(data)
    } catch (err: any) {
      console.error("Error fetching user data:", err)
      throw new Error("Failed to fetch user data")
    }
  }

  const fetchReferrals = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("referrals")
        .select(`
          *,
          users!referrals_referred_id_fkey(full_name, email)
        `)
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false })

      if (error) throw error
      if (data) setReferrals(data)
    } catch (err: any) {
      console.error("Error fetching referrals:", err)
      // Don't throw - referrals are not critical for dashboard load
    }
  }

  const fetchWithdrawals = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false })

      if (error) throw error
      if (data) setWithdrawals(data)
    } catch (err: any) {
      console.error("Error fetching withdrawals:", err)
      // Don't throw - withdrawals are not critical for dashboard load
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push("/")
    } catch (err) {
      console.error("Sign out error:", err)
    }
  }

  const copyReferralLink = () => {
    const referralLink = `${window.location.origin}/auth/signup?ref=${user?.referral_code}`
    navigator.clipboard.writeText(referralLink)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const handleWithdrawSuccess = () => {
    if (user) {
      fetchUserData(user.id)
      fetchWithdrawals(user.id)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Error Loading Dashboard</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="flex gap-2">
                <Button onClick={() => window.location.reload()} className="flex-1">
                  Refresh Page
                </Button>
                <Button variant="outline" onClick={handleSignOut} className="flex-1 bg-transparent">
                  Sign Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p>Redirecting to login...</p>
        </div>
      </div>
    )
  }

  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/signup?ref=${user.referral_code}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Welcome, {user.full_name}!</h1>
            <p className="text-gray-600">Manage your referrals and earnings</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{user.total_earnings.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Lifetime earnings from referrals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">₦{user.available_balance.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Ready for withdrawal</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{user.total_referrals}</div>
              <p className="text-xs text-muted-foreground">People you've referred</p>
            </CardContent>
          </Card>
        </div>

        {/* Referral Link Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Share2 className="mr-2 h-5 w-5" />
              Your Referral Link
            </CardTitle>
            <CardDescription>Share this link to earn ₦100 for each person who signs up</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 p-3 bg-gray-100 rounded-md text-sm break-all">{referralLink}</div>
              <Button onClick={copyReferralLink} className="shrink-0">
                <Copy className="mr-2 h-4 w-4" />
                {copySuccess ? "Copied!" : "Copy"}
              </Button>
            </div>
            {copySuccess && (
              <Alert className="mt-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>Referral link copied to clipboard!</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Withdraw Button */}
        <div className="mb-8">
          <Button
            size="lg"
            onClick={() => setShowWithdrawModal(true)}
            disabled={user.available_balance < 500}
            className="w-full sm:w-auto"
          >
            <Wallet className="mr-2 h-4 w-4" />
            Request Withdrawal (₦{user.available_balance.toFixed(2)} available - ₦50 charge applies)
          </Button>
          {user.available_balance < 500 && (
            <p className="text-sm text-gray-500 mt-2">
              Minimum withdrawal amount is ₦500.00. A charge of ₦50 will be deducted.
            </p>
          )}
        </div>

        {/* Tabs for Referrals and Withdrawals */}
        <Tabs defaultValue="referrals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="referrals">My Referrals</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawal History</TabsTrigger>
          </TabsList>

          <TabsContent value="referrals">
            <Card>
              <CardHeader>
                <CardTitle>Recent Referrals</CardTitle>
                <CardDescription>People who signed up using your referral link</CardDescription>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No referrals yet. Start sharing your link to earn money!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {referrals.map((referral) => (
                      <div key={referral.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{referral.users?.full_name || "Unknown User"}</p>
                          <p className="text-sm text-gray-500">{referral.users?.email || "No email"}</p>
                          <p className="text-xs text-gray-400">{new Date(referral.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge variant="secondary">+₦{referral.reward_amount.toFixed(2)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card>
              <CardHeader>
                <CardTitle>Withdrawal History</CardTitle>
                <CardDescription>Track your withdrawal requests and their status</CardDescription>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No withdrawal requests yet.</p>
                ) : (
                  <div className="space-y-4">
                    {withdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">₦{withdrawal.amount.toFixed(2)}</p>
                          <p className="text-sm text-gray-500">
                            Requested: {new Date(withdrawal.requested_at).toLocaleDateString()}
                          </p>
                          {withdrawal.admin_notes && (
                            <p className="text-xs text-gray-400 mt-1">Note: {withdrawal.admin_notes}</p>
                          )}
                        </div>
                        <Badge
                          variant={
                            withdrawal.status === "approved"
                              ? "default"
                              : withdrawal.status === "declined"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {withdrawal.status === "pending" && <Clock className="mr-1 h-3 w-3" />}
                          {withdrawal.status === "approved" && <CheckCircle className="mr-1 h-3 w-3" />}
                          {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        availableBalance={user.available_balance}
        onSuccess={handleWithdrawSuccess}
      />
    </div>
  )
}
