from app.services.disposable_email import DefaultDisposableEmailChecker, disposable_email_checker


def test_valid_emails_pass():
    valid_emails = [
        "alex.smith@company.com",
        "sarah@gmail.com",
        "jordan.taylor@outlook.com",
        "manager@retail-store.co.uk",
        "staff+rota@proton.me",
    ]
    for email in valid_emails:
        assert disposable_email_checker.is_valid_email_format(email) is True
        assert disposable_email_checker.is_disposable(email) is False


def test_disposable_domains_detected():
    disposable_emails = [
        "user@mailinator.com",
        "USER@MAILINATOR.COM",
        "test@10minutemail.com",
        "anon@tempmail.com",
        "fake@guerrillamail.com",
        "trash@yopmail.com",
        "spam@sharklasers.com",
        "temp@throwawaymail.com",
    ]
    for email in disposable_emails:
        assert disposable_email_checker.is_valid_email_format(email) is True
        assert disposable_email_checker.is_disposable(email) is True


def test_malformed_emails_rejected():
    malformed = [
        "",
        "plainaddress",
        "@missingusername.com",
        "username@.com",
        "username@domain..com",
        "username..dots@domain.com",
        None,
    ]
    for email in malformed:
        assert disposable_email_checker.is_valid_email_format(email) is False


def test_custom_disposable_checker_additions():
    custom_checker = DefaultDisposableEmailChecker(additional_domains={"custom-disposable.xyz"})
    assert custom_checker.is_disposable("user@custom-disposable.xyz") is True
    assert custom_checker.is_disposable("user@legitimate-provider.com") is False
