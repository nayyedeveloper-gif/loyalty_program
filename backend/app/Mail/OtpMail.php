<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public string $otp)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '29 Gold & Jewellery — Password Reset OTP',
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: '<div style="font-family:Georgia,serif;padding:24px;color:#1a1612">'
                .'<h2 style="color:#c9a227;margin:0 0 12px">29 Gold & Jewellery</h2>'
                .'<p>Your password reset code is:</p>'
                .'<p style="font-size:28px;letter-spacing:6px;font-weight:700">'.$this->otp.'</p>'
                .'<p style="color:#666">This code expires in 10 minutes. If you did not request it, ignore this email.</p>'
                .'</div>',
        );
    }
}
