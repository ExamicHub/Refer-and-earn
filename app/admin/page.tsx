"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, DollarSign, TrendingUp, LogOut, CheckCircle, XCircle, Clock, Eye, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { signOut } from "@/lib/auth"

interface User {
  id: string
  email: string
  full_name: string
  referral_code: string
  total_earnings: number
  available_balance: number
  total_referrals: number
  created_at: string
}

interface Withdrawal {
  id: string
  amount: number
  account_name: string
  account_number: string
  bank_name: string
  status: string
  requested_at: string
  processed_at: string | null
  admin_notes: string | null
  users: {
    full_name: string
    email: string
  }
}

interface Stats {
  totalUsers: number
  totalEarnings: number
  pendingWithdrawals: number
  totalReferrals: number
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalEarnings: 0,
    pendingWithdrawals: 0,
    totalReferrals: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [processing, setProcessing] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkAdminAuth()
  }, [])

  const checkAdminAuth = async () => {
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

      // Check if user is admin
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", authUser.id)
        .single()

      if (userError) {
        console.error("User lookup error:", userError)
        throw new Error("Failed to verify admin status")
      }

      if (!userData?.is_admin) {
        router.push("/dashboard")
        return
      }

      await fetchData()
      setLoading(false)
    } catch (err: any) {
      console.error("Admin auth error:", err)
      setError("Failed to load admin panel. Please try refreshing the page.")
      setLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      await Promise.all([fetchUsers(), fetchWithdrawals(), fetchStats()])
    } catch (err: any) {
      console.error("Data fetch error:", err)
      throw new Error("Failed to fetch admin data")
    }
  }

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("is_admin", false)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Users fetch error:", error)
      throw error
    }

    if (data) setUsers(data)
  }

  const fetchWithdrawals = async () => {
    const { data, error } = await supabase
      .from("withdrawals")
      .select(`
        *,
        users(full_name, email)
      `)
      .order("requested_at", { ascending: false })

    if (error) {
      console.error("Withdrawals fetch error:", error)
      throw error
    }

    if (data) setWithdrawals(data)
  }

  const fetchStats = async () => {
    const [usersCount, earningsSum, pendingWithdrawals, referralsCount] = await Promise.all([
      supabase.from("users").select("id", { count: "exact" }).eq("is_admin", false),
      supabase.from("users").select("total_earnings").eq("is_admin", false),
      supabase.from("withdrawals").select("amount", { count: "exact" }).eq("status", "pending"),
      supabase.from("referrals").select("id", { count: "exact" }),
    ])

    const totalEarnings = earningsSum.data?.reduce((sum, user) => sum + (user.total_earnings || 0), 0) || 0

    setStats({
      totalUsers: usersCount.count || 0,
      totalEarnings,
      pendingWithdrawals: pendingWithdrawals.count || 0,
      totalReferrals: referralsCount.count || 0,
    })
  }

  const handleWithdrawalAction = async (action: "approved" | "declined") => {
    if (!selectedWithdrawal) return

    setProcessing(true)
    try {
      const { error } = await supabase.rpc("process_withdrawal", {
        withdrawal_uuid: selectedWithdrawal.id,
        new_status: action,
        notes: adminNotes || null,
      })

      if (error) {
        console.error("Withdrawal processing error:", error)
        throw new Error("Failed to process withdrawal")
      }

      await fetchData()
      setSelectedWithdrawal(null)
      setAdminNotes("")
    } catch (error: any) {
      console.error("Error processing withdrawal:", error)
      alert("Failed to process withdrawal: " + error.message)
    } finally {
      setProcessing(false)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading admin panel...</p>
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
              <h2 className="text-xl font-bold mb-2">Error Loading Admin Panel</h2>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-gray-600">Manage users and withdrawals</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₦{stats.totalEarnings.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pendingWithdrawals}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReferrals}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="withdrawals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="withdrawals">Withdrawal Requests</TabsTrigger>
            <TabsTrigger value="users">All Users</TabsTrigger>
          </TabsList>

          <TabsContent value="withdrawals">
            <Card>
              <CardHeader>
                <CardTitle>Withdrawal Requests</CardTitle>
                <CardDescription>Review and process user withdrawal requests</CardDescription>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No withdrawal requests found.</p>
                ) : (
                  <div className="space-y-4">
                    {withdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{withdrawal.users?.full_name || "Unknown User"}</p>
                            <Badge
                              variant={
                                withdrawal.status === "approved"
                                  ? "default"
                                  : withdrawal.status === "declined"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {withdrawal.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{withdrawal.users?.email || "No email"}</p>
                          <p className="text-lg font-semibold text-green-600">₦{withdrawal.amount.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">
                            Requested: {new Date(withdrawal.requested_at).toLocaleString()}
                          </p>
                          {withdrawal.admin_notes && (
                            <p className="text-xs text-gray-500 mt-1">Admin note: {withdrawal.admin_notes}</p>
                          )}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setSelectedWithdrawal(withdrawal)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Overview of all registered users and their activity</CardDescription>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No users found.</p>
                ) : (
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <p className="text-xs text-gray-400">
                            Joined: {new Date(user.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">Referral Code: {user.referral_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">₦{user.total_earnings.toFixed(2)} earned</p>
                          <p className="text-sm text-gray-600">₦{user.available_balance.toFixed(2)} available</p>
                          <p className="text-xs text-gray-500">{user.total_referrals} referrals</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Withdrawal Details Modal */}
      <Dialog open={!!selectedWithdrawal} onOpenChange={() => setSelectedWithdrawal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdrawal Request Details</DialogTitle>
            <DialogDescription>Review and process this withdrawal request</DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">User:</p>
                  <p>{selectedWithdrawal.users?.full_name || "Unknown User"}</p>
                  <p className="text-gray-600">{selectedWithdrawal.users?.email || "No email"}</p>
                </div>
                <div>
                  <p className="font-medium">Amount:</p>
                  <p className="text-lg font-semibold text-green-600">₦{selectedWithdrawal.amount.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Account Name:</span> {selectedWithdrawal.account_name}
                </p>
                <p>
                  <span className="font-medium">Account Number:</span> {selectedWithdrawal.account_number}
                </p>
                <p>
                  <span className="font-medium">Bank Name:</span> {selectedWithdrawal.bank_name}
                </p>
                <p>
                  <span className="font-medium">Requested:</span>{" "}
                  {new Date(selectedWithdrawal.requested_at).toLocaleString()}
                </p>
                <p>
                  <span className="font-medium">Status:</span>
                  <Badge
                    className="ml-2"
                    variant={
                      selectedWithdrawal.status === "approved"
                        ? "default"
                        : selectedWithdrawal.status === "declined"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {selectedWithdrawal.status}
                  </Badge>
                </p>
              </div>

              {selectedWithdrawal.status === "pending" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="adminNotes">Admin Notes (Optional)</Label>
                    <Textarea
                      id="adminNotes"
                      placeholder="Add any notes about this withdrawal..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => handleWithdrawalAction("declined")}
                      disabled={processing}
                      className="flex-1"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                    <Button onClick={() => handleWithdrawalAction("approved")} disabled={processing} className="flex-1">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  </div>
                </>
              )}

              {selectedWithdrawal.admin_notes && (
                <Alert>
                  <AlertDescription>
                    <strong>Admin Notes:</strong> {selectedWithdrawal.admin_notes}
                  </AlertDescription>
                </Alert>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Note: ₦50 charge will be deducted from user's balance upon approval
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
