"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface WithdrawModalProps {
  isOpen: boolean
  onClose: () => void
  availableBalance: number
  onSuccess: () => void
}

export default function WithdrawModal({ isOpen, onClose, availableBalance, onSuccess }: WithdrawModalProps) {
  const [amount, setAmount] = useState("")
  const [accountName, setAccountName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const withdrawAmount = Number.parseFloat(amount)

    if (withdrawAmount < 500) {
      setError("Minimum withdrawal amount is ₦500.00")
      setLoading(false)
      return
    }

    if (withdrawAmount + 50 > availableBalance) {
      setError("Withdrawal amount plus ₦50 charge exceeds available balance")
      setLoading(false)
      return
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError

      if (!user) {
        setError("User not authenticated")
        setLoading(false)
        return
      }

      const { error: insertError } = await supabase.from("withdrawals").insert({
        user_id: user.id,
        amount: withdrawAmount,
        account_name: accountName,
        account_number: accountNumber,
        bank_name: bankName,
      })

      if (insertError) {
        console.error("Withdrawal insert error:", insertError)
        throw new Error("Failed to submit withdrawal request")
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
        onSuccess()
        // Reset form
        setAmount("")
        setAccountName("")
        setAccountNumber("")
        setBankName("")
      }, 2000)
    } catch (err: any) {
      console.error("Withdrawal submission error:", err)
      setError(err.message || "Failed to submit withdrawal request")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
      setError("")
      setSuccess(false)
    }
  }

  if (success) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Request Submitted!</h2>
            <p className="text-gray-600">
              Your withdrawal request has been submitted and is pending admin approval. You'll be notified once it's
              processed.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Withdrawal</DialogTitle>
          <DialogDescription>
            Enter your bank account details to request a withdrawal. Available balance: ₦{availableBalance.toFixed(2)}{" "}
            (₦50 charge applies)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Withdrawal Amount (₦)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="500"
              max={availableBalance}
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Note: A charge of ₦50 will be deducted from your available balance upon approval.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountName">Account Holder Name</Label>
            <Input
              id="accountName"
              type="text"
              placeholder="Full name on account"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              type="text"
              placeholder="Bank account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bankName">Bank Name</Label>
            <Input
              id="bankName"
              type="text"
              placeholder="Name of your bank"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1 bg-transparent">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
