import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ---- Phone number entry: the built-in screen's country picker and checks, without a phone-number library.

export const INVALID_PHONE = "Invalid phone number. Please check the number and try again.";

// Dial code of every country (iso2 + digits), from country-telephone-data, which the built-in picker lists.
const COUNTRY_DIAL_CODES = new Map(
  "af93 ax358 al355 dz213 as1684 ad376 ao244 ai1264 aq672 ag1268 ar54 am374 aw297 au61 at43 az994 bs1242 bh973 bd880 bb1246 by375 be32 bz501 bj229 bm1441 bt975 bo591 ba387 bw267 bv47 br55 io246 vg1284 bn673 bg359 bf226 bi257 kh855 cm237 ca1 cv238 bq599 ky1345 cf236 td235 cl56 cn86 cx61 cc61 co57 km269 cd243 cg242 ck682 cr506 ci225 hr385 cu53 cw599 cy357 cz420 dk45 dj253 dm1767 do1 ec593 eg20 sv503 gq240 er291 ee372 et251 fk500 fo298 fj679 fi358 fr33 gf594 pf689 tf262 ga241 gm220 ge995 de49 gh233 gi350 gr30 gl299 gd1473 gp590 gu1671 gt502 gg44 gn224 gw245 gy592 ht509 hm672 hn504 hk852 hu36 is354 in91 id62 ir98 iq964 ie353 im44 il972 it39 jm1876 jp81 je44 jo962 kz7 ke254 ki686 xk383 kw965 kg996 la856 lv371 lb961 ls266 lr231 ly218 li423 lt370 lu352 mo853 mk389 mg261 mw265 my60 mv960 ml223 mt356 mh692 mq596 mr222 mu230 yt262 mx52 fm691 md373 mc377 mn976 me382 ms1664 ma212 mz258 mm95 na264 nr674 np977 nl31 nc687 nz64 ni505 ne227 ng234 nu683 nf672 kp850 mp1670 no47 om968 pk92 pw680 ps970 pa507 pg675 py595 pe51 ph63 pn64 pl48 pt351 pr1 qa974 re262 ro40 ru7 rw250 bl590 sh290 kn1869 lc1758 mf590 pm508 vc1784 ws685 sm378 st239 sa966 sn221 rs381 sc248 sl232 sg65 sx1721 sk421 si386 sb677 so252 za27 gs500 kr82 ss211 es34 lk94 sd249 sr597 sj47 sz268 se46 ch41 sy963 tw886 tj992 tz255 th66 tl670 tg228 tk690 to676 tt1868 tn216 tr90 tm993 tc1649 tv688 vi1340 ug256 ua380 ae971 gb44 us1 um1 uy598 uz998 vu678 va39 ve58 vn84 wf681 eh212 ye967 zm260 zw263".split(" ").map((entry) => [entry.slice(0, 2), entry.slice(2)]),
);
const DIAL_CODES = [...new Set(COUNTRY_DIAL_CODES.values())].sort((a, b) => Number(a) - Number(b));

// The dial code of the browser's region (en-DE → +49), else +1.
export function defaultDialCode() {
  const region = typeof navigator === "undefined" ? undefined : navigator.language.split("-")[1]?.toLowerCase();
  const dialCode = region && COUNTRY_DIAL_CODES.get(region);
  return dialCode ? `+${dialCode}` : "+1";
}

// The built-in screen asks libphonenumber whether the number is valid for its country. Here only the
// length E.164 allows is checked (the shortest real numbers have 7 digits in all, the longest 15); the
// server runs the full per-country check before any text is sent, and answers with the same message.
export function isPlausiblePhone(fullPhone) {
  const digits = fullPhone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

const matchesSearch = (code, search) => {
  const normalized = search.replace(/\+/g, "");
  return normalized === "" || code.startsWith(normalized);
};

// A searchable list of dial codes. Typing narrows it, and closing it with one match left picks that one.
function DialCodePicker({ value, onChange }) {
  const { t } = useTranslation(["auth", "translation"]);
  const [open, setOpen] = useState(false);
  const search = useRef("");

  const handleOpenChange = (next) => {
    if (!next && search.current) {
      const matches = DIAL_CODES.filter((code) => matchesSearch(code, search.current));
      if (matches.length === 1) onChange(`+${matches[0]}`);
      search.current = "";
    }
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={t("Country code")}
          className="h-10 w-[100px] justify-between px-2.5 font-normal shadow-none">
          {value}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[140px] p-0" align="start" side="bottom" avoidCollisions={false}>
        <Command filter={(item, text) => (matchesSearch(item, text) ? 1 : 0)}>
          <CommandInput placeholder={t("Search...")} className="h-9" onValueChange={(text) => { search.current = text; }} />
          <CommandList>
            <CommandEmpty>{t("No match")}</CommandEmpty>
            <CommandGroup>
              {DIAL_CODES.map((code) => (
                <CommandItem key={code} value={code} onSelect={() => { onChange(`+${code}`); search.current = ""; setOpen(false); }}>
                  +{code}
                  <Check className={cn("ml-auto h-3.5 w-3.5", value === `+${code}` ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Dial code picker plus the number (digits only, 15 at most). Once 4 digits are in, a number that can't
// be real is flagged as you type; `error` (from a failed send) takes the place of that message.
export function PhoneField({ countryCode, onCountryCodeChange, phoneNumber, onPhoneNumberChange, error, onSubmit }) {
  const { t } = useTranslation(["auth", "translation"]);
  const [touched, setTouched] = useState(false);
  const invalid = touched && phoneNumber.length >= 4 && !isPlausiblePhone(`${countryCode}${phoneNumber}`);
  const message = error ?? (invalid ? INVALID_PHONE : null);
  const displayMessage = message === INVALID_PHONE ? t(INVALID_PHONE) : message;
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <DialCodePicker value={countryCode} onChange={onCountryCodeChange} />
        <Input id="mfa-phone" type="tel" autoComplete="tel-national" autoFocus value={phoneNumber} maxLength={15}
          placeholder="5551234567" aria-invalid={Boolean(displayMessage)}
          onChange={(e) => { onPhoneNumberChange(e.target.value.replace(/\D/g, "")); setTouched(true); }}
          onKeyDown={(e) => { if (e.key === "Enter" && onSubmit) { e.preventDefault(); onSubmit(); } }}
          className={cn("h-10 flex-1", message && "border-destructive focus-visible:ring-destructive")} />
      </div>
      {message
        ? <p className="text-sm text-destructive">{message}</p>
        : <p className="text-sm text-muted-foreground">{t("Standard message and data rates may apply.")}</p>}
    </div>
  );
}

// Copies the setup key: an icon next to the key, or with `wide` the full-width "Copy key" button used on phones.
export function CopyKeyButton({ text, wide = false }) {
  const { t } = useTranslation(["auth", "translation"]);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text.replace(/\s/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  if (wide) {
    return (
      <Button type="button" variant="outline" className="w-full h-11" onClick={copy}>
        {copied ? t("Copied") : t("Copy key")}
      </Button>
    );
  }
  return (
    <button type="button" onClick={copy} title={t("Copy to clipboard")} aria-label={t("Copy to clipboard")}
      className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted">
      {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
    </button>
  );
}


// Phones and tablets run the authenticator app on this device, so a QR code can't be scanned.
export function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
}
