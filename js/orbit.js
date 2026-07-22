/* ============================================================
   RLTOrbit — Earth globe + flight animations (zero dependencies).
   - Modal: globe turned to the launch pad, day/night terminator
     computed for the actual liftoff time, animated ascent along
     the real launch azimuth into the mission's orbit class,
     booster separation, insertion flash, phase captions.
   - Map view: all launch sites on a rotating Earth with the
     live terminator.
   Coastlines: Natural Earth 110m (public domain), simplified.
   All trajectories illustrative.
   ============================================================ */
(function(){
  "use strict";
  const TAU = Math.PI * 2;
  const D2R = Math.PI / 180;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- coastline data (packed lat/lon polylines) ---------- */
  const CA = "!#$%&()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_abcdefghijklmnopqrstuvwxyz{}~";
  const CD = "!7$d!5$c!5$]!5$X!6$V!6$Y!6$^!7$a!7$d|!8!M!8!I!8!F!9!E!:!D!;!E!:!I!:!K!9!L!8!M|!;%%!:%(!9%)!7%)!6%%!6%!!5$z!5$v!5$q!6$o!7$s!8$u!9$v!:$x!;$z!;%!!;%%|!D#@!D#B!D#E!C#C!C#B!C#?!D#=!D#@|!D#7!C#:!D#6!D#3!E#5!D#7|!G#n!G#p!G#r!F#t!F#p!F#m!F#j!F#h!G#g!G#k!G#n|!I$P!G$O!F$M!F$K!F$H!G$G!F$E!G$C!H$E!I$I!J$J!M$K!M$L!L$N!K$O!I$P|!.!!!/!$!.!(!/!*!.!.!/!1!/!7!/!9!.!=!-!C!-!G!,!O!-!U!,!^!,!d!,!i!-!o!.!g!.!a!/!^!0!X!1!Y!3!Y!3!V!4!T!5!Q!5!V!5![!4!_!5!c!6!g!6!h!8!e!8!b!8!]!9!X!9!T!:!S!:!P!;!O!=!N!<!Q!=!T!=!X!<!Y!<!]!=!a!=!d!>!f!>!i!@!h!A!k!@!l!@!o!A!r!A!u!A!w!B!z!B!}!B##!B#&!B#)!B#,!B#/!B#2!B#4!B#7!B#:!B#=!B#@!B#C!C#E!C#G!C#J!C#L!D#N!C#O!B#Q!B#S!A#V!A#Y!A#[!A#_!A#b!A#e!A#h!@#k!A#l!B#j!C#g!D#f!F#e!E#f!E#i!E#k!E#n!E#p!D#s!D#v!D#y!E#{!D#~!D$$!F$&!E$(!E$*!E$-!D$/!D$1!D$4!C$6!D$8!D$:!D$=!D$?!C$A!C$C!D$E!D$G!D$J!E$M!E$O!E$Q!F$R!H$R!I$Q!K$P!M$Q!O$R!P$R!Q$R!S$U!S$V!T$X!U$Z!V$^!V$_!W$b!W$c!X$e!X$g!W$f!W$c!V$b!V$_!U$^!T$]!S$^!R$[!R$Z!Q$W!P$V!N$V!M$Y!M$[!K$]!J$^!G$_!E$a!D$a!C$_!B$^!B$Z!@$X!@$U!?$S!?$P!?$M!>$L!>$I!>$E!>$B!>$?!<$B!<$D!;$F!;$C!;$@!:$=!9$=!8$?!6$B!6$G!6$J!5$M!4$Q!4$V!4$Z!3$_!2$d!1$f!1$i!2$l!2$p!3$t!4$w!4$}!3%%!3%*!4%,!4%.!4%4!5%7!5%;!5%?!6%D!6%G!7%E!8%E!8%A!8%=!8%9!:%8!;%<!<%@!<%B!=%D!>%F!>%I!>%L!?%P!?%S!?%V!@%X!@%Z!A%^!A%a!B%c!C%a!E%c!E%e!F%g!F%i!G%k!H%l!H%m!H%p!H%s!I%t!I%v!H%y!H%}!I&!!I&%!H&)!I&+!I&-!I&/!J&1!J&4!K&5!K&6!K&8!K&:!J&<!I&=!J&?!K&B!K&D!K&G!K&I!K&K!K&N!K&P!K&R!J&T!J&V!J&Y!J&[!J&^!J&a!K&c!K&e!K&g!L&i!L&k!M&l!N&m!N&o!M&q!M&s!L&u!K&v!L&x!M&{!N&~!N(#!N(%!O((!O()!P(+!P(-!P(/!Q(0!Q(2!Q(4!S(6!S(7!S(9!S(;!S(=!S(?!S(@!Q(B!P(F!P(G!O(I!O(K!O(L!P(N!P(P!P(R!O(T!O(V!O(X!M(Y!K(W!J(V!J(X!H(W!G(W!F(Z!G(]!H(^!I(a!J(b!K(d!L(g!L(i!L(k!N(m!N(n!O(p!O(r!P(t!P(x!Q(y!Q({!Q)!!Q)#!S)$!Q)&!Q)(!Q)*!Q),!Q).!Q)0!Q)3!P)5!Q)6!Q)9!Q):!Q)<!Q)>!R)@!T)C!S)E!R)G!Q)I!Q)K!Q)M!Q)O!R)Q!R)S!S)T!S)W!S)X!S)Z!R)]!R)_!Q)b!Q)d!P)g!Q)i!Q)j!R)l!R)m!R)o!R)q!R)s!R)u!R)w!Q)y!R)z!R)~!R*#!R*%!R*(!S**!T**!T*+!R*,!Q*/!Q*1!Q*4!Q*6!Q*8!Q*:!Q*=!Q*?!Q*@!O*A!O*C!N*F!N*H!N*K!M*M!M*O!N*Q!M*R!M*T!L*V!L*X!L*Z!K*_!J*a!J*c!J*f!I*h!I*j!I*m!I*o!I*q!H*s!H*t!F*s!E*r!D*q!C*n!C*m!B*j!A*h!@*f!?*e!=*e!<*f!;*g!:*k!9*h!9*e!9*b!8*_!6*^!5*]!4*_!4*a!3*c!2*e!2*h!1*k!0*p!/*q!/*w!.*x!/+!!.+(!.!!|!m$Q!l$T!l$W!k$V!k$T!j$Q!j$O!k$M!k$K!l$H!m$F!o$D!o$E!n$H!m$K!n$L!o$L!p$N!o$P!m$Q|!s$f!r$h!q$d!p$b!q$a!r$c!r$e!s$f|!v([!u(W!w(X!w([!v([|#,*?#,*A#,*C#**E#(*D#&*B#&*@#)*?#,*=#,*?|#,*x#,*z#**z#(*x#&*w#%*u##*t!~*s!}*r!}*o!}*n!~*k##*l#%*o#&*q#(*s#)*t#**u#,*v#-*x#,*x|#6*{#4*~#3+!#2+$#3+&#1+(#0+$#.+$#-+##++!#+*}#+*{#-*}#/*z#0*{#2*{#5*{#6*z#8*x#9*w#8*y#7*{#6*{|#R*l#R*j#S*i#T*h#U*f#T*i#S*k#R*l|#[+(#Z+(#Z+%#[+%#[+(|#^!!#]+*#^+(#^+*#_!!|#^*n#_*l#^*n|#b*l#a*m#a*k#b*l|#e(2#b(2#a(3#^(2#](1#Z(1#X(0#U(/#Q(.#N(-#L(,#L(+#K()#L(%#O($#P($#S($#T(%#V(&#X(%#[(%#](&#_((#_(*#b(,#c(-#e(.#f(0#h(0#f(2#e(2|#d*;#c*<#d*=#b*?#^*?#]*@#Z*@#X*A#W*C#V*D#U*F#S*G#Q*G#Q*I#O*J#N*K#K*N#J*N#G*N#F*O#D*O#A*N#?*N#=*M#<*K#:*K#8*I#5*H#3*H#2*G#2*E#2*C#0*A#1*?#2*>#0*;#1*9#1*7#2*5#3*4#5*4#7*2#7*0#9*0#8*/#7*.#9*/#;*0#:*.#:*-#8*,#9**#<*)#<*(#>*%#?*!#?)z#>)w#=)u#>)s#=)q#<)o#:)n#:)k#:)j#:)g#9)f#9)d#8)b#9)]#;)[#;)]#>)^#A)[#C)[#D)Z#F)Y#G)Y#I)X#K)X#I)Y#L)X#M)X#O)X#Q)X#R)Y#S)]#T)^#U)_#U)c#V)e#W)i#X)j#Z)k#[)l#^)m#[)n#_)o#a)p#b)q#c)r#d)t#c)w#b)x#b)z#e){#g)}#h)~#h*$#i*##i*%#h*&#h*)#h*+#h*-#g*.#e*-#d*,#b*+#a*-#_*.#]*1#]*2#[*4#[*6#^*7#b*7#e*7#g*8#h*8#j*8#h*:#f*;#d*;|#k*b#l*a#k*b|#l)h#m)e#m)g#l)i#l)h|#l*_#l*]#m*^#l*_|#m*a#n*_#m*a|#l)p#k)n#m)o#n)q#o)s#o)u#n)s#m)q#l)p|#p)c#o)e#n)c#n)_#o)a#p)c|#p)m#n)j#n)g#p)h#o)j#p)m|#o*]#p*Z#p*Y#p*[#o*]|#q*W#r*U#r*V#q*W|#r)N#r)R#r)V#q)W#p)Z#o)]#n)Z#o)X#o)V#o)T#p)R#q)P#p)N#q)J#r)H#t)I#t)L#s)M#r)N|#t*)#r*(#t*)#t*)|#r*T#s*R#t*Q#v*Q#u*R#t*S#r*T|#u*L#t*K#s*H#t*F#u*E#u*G#v*H#u*J#v*K#x*L#v*M#u*L|#y)u#y)s#z)u#y)u|#z)}#x)~#y){#y)y#y)w#z)z#z)}|#w*N#x*M#z*K#{*I#z*L#y*M#w*N|$!*(#z*)#y*+#{*-#~*/#}*2#{*4#{*6#y*9#x*=#w*?#v*@#t*C#s*B#p*D#n*E#m*G#m*H#k*J#k*H#k*F#l*D#m*B#n*A#p*@#q*=#p*<#p*;#m*9#n*6#o*4#p*2#o*/#q*0#q*1#t*1#u*0#w*,#w**#y*&#x*%#y*%#z*##{*%#}*##~*##~)~$!)}$#*#$!*($!*(|$()q$%)p$$)n$%)l$%)i$$)g#~)i$!)j$#)n#~)l#})j#z)l#w)m#u)l#w)l#v)j#y)i#{)i#z)h#x)h#u)h#u)f#w)f#y)f#z)e#})e#~)f$$)g$()i$&)j$&)m$&)o$()q$()q|$&)x$%)x$#)w$!)x$#)v$&)v$))v$()x$&)x|#t)I#t)F#v)E#x)B#y)A#z)@#})?$#)=$$)<$&);$)):$*)8$,)7$-)6$/)4$0)5$/)8$.):$,);$+)<$))>$))@$()B$%)C$$)E$#)D$!)E#})F#{)G#z)I#w)I#t)I|$))c$&)e$&)c$$)b$!)b#~)_#{)_#x)^#x)[#y)Z#z)X#y)U#z)S#z)Q#~)Q$#)O$%)O$()O$))P$()R$))S$*)T$+)W$-)X$.)Y$0)]$1)^$3)_$2)b$0)d$0)e$/)d$-)c$+)b$*)c$))c|$6)t$3)t$2)s$4)s$3)r$1)r$1)o$3)o$5)n$4)m$3)k$5)l$6)m$6)n$6)p$7)r$8)s$6)t|$1(r$1(q$3(p$5(o$9(p$8(r$6(s$4(t$2(s$1(r|$9$a$9$^$;$a$9$a|$:)o$8)n$8)l$:)m$;)n$:)o|$8)d$6)a$7)b$8)d$:)e$<)f$:)f$9)e$8)d|$=)k$<)l$;)m$:)k$<)k$=)k|$=)r$;)s$<)q$:)r$;)q$<)p$>)p$>)q$=)r|$?)j$=)j$>)i$@)h$?)j|$J)j$J)k$G)l$F)l$E)j$C)j$B)j$B)l$A)o$?)o$?)n$A)k$@)i$B)h$C)g$F)g$H)h$J)h$J)j|$I$V$I$T$J$S$J$T$I$V|$I$?$I$<$J$>$I$@$I$?|$M$H$L$J$M$K$L$M$L$O$J$P$J$O$I$M$J$K$H$J$I$H$I$F$J$D$J$F$J$H$L$G$M$H|$J)R$I)P$J)N$M)O$M)Q$L)S$J)R|$K!T$L!S$M!T$L!U$K!T|$N!S$O!R$N!S|$S$:$R$<$P$?$O$@$O$B$N$C$N$E$M$C$M$@$M$=$N$?$N$=$P$<$Q$9$Q$5$R$3$Q$2$Q$0$R$1$S$2$S$4$S$6$S$:|$U$>$V$=$W$=$V$>$U$>|$S)i$Q)h$S)g$V)h$X)j$V)k$S)i|$Z$=$Z$;$[$=$Z$=|$Z$?$Y$>$[$=$Z$?|$k*)$i*($j*&$i*$$k*%$l*($k*)|$n&n$m&m$l&k$m&j$n&k$n&n|$n&V$n&Y$m&Z$m&X$n&V$n&V|$s&F$r&E$q&D$r&@$s&B$s&E$s&F|$y&9$x&;$u&:$u&9$x&8$y&9|$q*6$p*5$m*5$l*2$l*.$j*,$k**$l*&$k*#$k)~$i*#$f*!$e)}$h)}$h){$j)z$j)}$k)~$m*#$n*$$n*)$n*+$r*-$q*/$s*2$s*3$v*4$x*4$y*5$z*7$w*8$s*6$q*6|${&:$z&9$}&8$~&:${&:|%#*<%#*=%$*?%!*?$~*<${*:$}*7$z*6$z*4$}*4%!*5%!*7%%*7%&*8%$*:%#*<|%)$Z%)$^%($]%)$Y%)$Z|%.$^%/$Z%0$X%/$[%/$^%.$^|%-#;%.#7%/#4%0#2%1#1%1#3%1#6%/#8%.#:%-#;|%1$k%0$i%0$k%/$m%.$p%-$o%,$q%+$r%)$q%*$o%+$o%*$l%+$j%+$h%+$d%-$e%.$f%1$h%3$j%3$k%1$k|%8#)%8#+%6#*%4#,%5#*%7#(%8#)|%1*;%.*=%/*:%,*9%**;%(*8%**8%,*8%.*8%/*8%2*8%4*7%7*7%8*9%5*;%4*:%1*;|%5%t%3%q%4%n%6%p%8%o%9%q%:%s%9%w%8%v%5%t|%;&@%:&?%;&=%<&@%;&@|%>!Y%=!W%?!V%@!W%@!Z%>!Y|%A%}%?%z%?%}%?&!%>&!%<%}%<&!%9&$%7&&%5&*%4&)%3&*%2&(%2&$%1%~%0%{%1%y%0%x%2%y%3%{%3%x%5%z%6%x%7%}%9%{%:%x%<%x%;%w%=%w%>%v%@%v%A%x%A%}|%D!@%D!=%E!@%D!@|%H$:%G$:%H$8%I$:%H$:|%I$5%H$3%I$1%J$3%J$5%I$5|%L!4%K!6%K!8%K!:%J!8%J!6%K!4%L!4|%O$/%O$0%N$3%M$6%L$7%K$9%K$7%K$4%L$3%K$1%J$.%K$-%K$+%L$,%N$-%O$-%O$/|%Q%e%N%g%M%d%K%]%K%[%K%X%L%R%M%T%N%P%N%T%O%O%Q%Q%Q%T%O%W%Q%Z%P%]%Q%b%Q%e|%R$A%R$?%T$?%U$A%T$C%R$A|%V!!%T!(%R!-%Q!.%R!.%R!3%P!7%O!5%O!2%M!2%M!/%M!.%N!+%O!)%O!%%P!%%P!!%O!#%N!!|%N!!%V!!|%V#u%V#s%V#q%V#o%W#l%W#n%X#p%X#r%W#s%V#u|%[!!%Z++%Z+)%[!!|%[!!%[!$%[!(%Z!%%Z!!%[!!|%W$#%U$#%W$&%U$)%T$(%R$*%T$,%V$.%X$.%X$1%W$4%V$6%T$5%S$6%Q$2%Q$0%Q$-%N$+%L$(%L$$%K$#%J#}%H#z%F#x%D#w%B#w%B#z%@#z%>#{%?$!%>$&%=$)%<$*%;$-%;$/%:$2%:$4%9$4%7$5%4$6%2$9%3$;%5$<%8$;%9$9%:$=%<$?%=$@%@$>%B$<%D$>%F$=%I$=%I$>%I$B%H$D%I$E%H$G%G$J%F$N%B$N%B$P%@$R%B$U%D$W%E$X%C$Y%@$]%>$_%=$^%<$b%:$d%:$g%9$h%8$i%7$k%4$l%4$j%3$i%2$e%0$c%0$_%1$Y%1$V%0$T%/$S%.$P%+$M%*$K%*$L%-$P%.$T%.$W%-$Y%,$W%*$W%($X%&$[%($_%*$b%($c%&$a%$$Z%$$Y%!$V%$$U%&$X%&$U%%$S%$$Q%#$O%!$M$~$L${$L$z$K$z$I$y$G$y$F$y$I$x$F$x$D$u$C$v$B$u$C$s$B$q$A$s$B$u$@$s$@$q$@$n$B$m$@$l$>$k$=$j$;$h$8$g$7$f$6$c$6$a$7$_$8$[$9$Y$9$W$8$X$6$Z$5$]$4$_$4$c$2$b$/$c$-$d$*$d$($c$%$b$&$a$$$b#~$b#{$c#z$b#w$_#u$_#s$^#r$Z#q$Y#r$W#q$S#p$Q#q$N#r$M#s$K#t$J#v$J#y$J#}$L$!$N$#$P$%$P$($P$*$P$+$N$*$K$*$J$)$H$($F$($E$&$D$)$E$*$E$,$E$.$E$0$D$1$C$3$A$2$?$2$=$2$;$2$9$3$7$5$7$6$7$8$8$:$8$<$7$>$6$?$8$A$:$B$;$C$<$E$<$H$>$I$=$K$<$I$:$J$9$I$7$J$9$K$;$J$<$M$=$M$<$N$;$Q$:$R$:$U$9$V$:$X$:$[$:$^$:$]$9$_$8$a$6$b$6$c$5$e$4$f$3$g$2$h$1$k$1$m$1$o$0$q$.$s$,$u$)$v$&$w$$$v$$$z$!$z$#${$!%!#~%%#}%&#{%)#z%-#z%0#y%3#v%6#v%7#u%:#s%:#n%:#m%9#j%6#h%5#f%3#d%2#a%2#]%2#Y%1#W%0#T%.#R%.#Q%,#P%*#O%&#N%$#N%!#L$}#J$z#H$z#F$z#D$x#@$v#>$t#>$r#<$r#:$p#9$o#8$m#8$l#9$i#:$f#7$i#5$j#2$h#1$e#0$a#0$]#.$]#,$]#,$Y#,$X#*$W#)$X#)$Z#($X#&$W#$$V##$T#!$R!}$R!{$T!{$V!y$U!x$S!u$Q!t$P!q$O!p$Q!p$N!o$K!m$K!n$H!o$F!p$C!r$B!t$B!x$B!z$C!{$E!}$B!~$D#%$D#$$G#)$H#*$F#&$F#*$E#.$F#/$G#1$F#4$F#7$H#:$I#=$J#@$J#B$J#D$J#G$K#K$L#O$L#S$M#V$M#Y$L#Z$J#^$F#a$C#c$A#d$@#h$?#k$=#o$;#r$9#s$8#t$6#w$6#x$7#y$8#{$9#}$7$!$7$#$8$%$9$&$:$($;$*$<$*$=$,$>$-$?$.$>$0$>$2$>$3$=$5$<$7$;$6$9$6$8$4$9$3$7$4$6$5$5$6$2$8$1$8$0$9$.$:$-$<$-$=$,$?$*$?$($@$%$@$$$A$!$B#}$D#y$E#w$E#t$E#q$E#p$F#n$G#j$H#i$I#g$J#e$L#b$M#a$O#a$Q#a$S#_$U#]$V#Z$W#Y$X#W$Z#V$[#U$^#U$_#R$a#R$c#P$e#P$f#N$g#L$c#M$a#O$_#P$^#P$[#R$Z#S$X#S$W#U$V#V$T#W$S#V$T#U$U#T$V#S$X#R$Z#P$[#O$[#M$]#L$^#N$b#L$c#J$e#I$f#I$h#H$j#F$k#E$l#C$l#A$m#A$o#?$r#=$s#<$u#;$w#:$x#9$y#:$~#9%!#:%&#:%*#:%+#9%,#<%*#=%,#=%.#<%0#8%1#7%2#3%3#2%6#0%7#/%9#-%:#,%;#*%=#*%>#&%@#%%@##%@!}%A!y%C!u%C!s%D!p%D!m%E!i%F!g%E!e%D!e%C!b%C!_%B!]%E!]%F!_%E![%D!Z%C!W%B!X%@!W%?!T%?!R%=!O%;!L%;!I%:!G%9!E%9!A%:!C%;!E%<!G%<!J%=!K%>!N%?!P%A!P%B!Q%A!O%A!M%B!L%A!H%C!G%D!F%D!C%E!B%E!@%G!?%H!@%I!A%J!C%K!F%L!I%M!H%N!I%M!F%M!D%M!A%M!>%O!;%P!>%Q!B%P!C%P!H%Q!F%R!D%S!B%T!@%U!=%V!?%V!B%W!E%Y!G%Y!I%Z!M%Z!O%[!R%Z!U%Y!V%Z![%Y!_%Y!b%X!f%X!j%X!k%X!n%X!q%W!s%W!w%V!z%V!}%W#!%W#$%W#(%X#+%X#.%X#0%X#1%Y#3%W#6%X#9%W#<%X#?%W#B%V#G%V#J%V#L%U#N%T#K%S#O%T#T%T#V%S#X%T#Z%U#X%U#Z%U#]%V#_%U#a%T#c%T#f%S#i%T#l%T#o%U#q%T#t%S#t%T#u%V#x%W#u%X#s%Z#s%]#v%]#x%[#z%X#~%W#{%W$#|%_#N%^#M%_#Q%^#T%_#V%^#X%[#Z%]#[%_#Y%_#[%_#^%^#a%[#b%Z#c%Y#f%X#j%W#g%V#h%V#d%V#_%V#]%V#X%U#R%U#O%V#N%W#L%V#J%X#G%X#L%X#O%Y#Q%Y#M%Y#I%Y#F%[#J%[#G%[#C%^#E%^#F%a#L%_#N|%a#c%_#a%a#]%a#a%a#c|%_$@%_$>%_$<%^$:%a$7%b$8%a$=%_$@|%_$,%^$-%a$/%b$4%^$8%^$;%_$=%]$B%]$E%[$I%Z$K%Y$O%X$Q%V$S%U$O%T$T%T$W%R$Z%R$^%P$^%N$Y%O$W%Q$T%Q$Q%N$S%M$V%K$X%I$W%J$T%K$O%J$R%I$T%I$O%J$K%K$I%L$F%M$C%L$>%M$<%O$=%O$A%O$E%S$H%T$F%U$C%V$?%X$>%X$=%X$;%W$6%X$/%Y$+%Y$(%Z$%%Z$(%Z$$%]$$%_$%%a$(%b$-%_$,|%b#k%a#n%b#q%_#p%^#s%[#s%[#o%[#m%[#l%^#g%^#k%a#i%b#k|%_*;%_*8%a*4%b*6%b*8%a*;%_*;|%_#z%]#w%]#u%_#t%b#u%b#w%b#{%b$#%_#}%_#z|%[#A%Z#<%[#;%]#6%_#8%a#:%c#8%c#?%b#B%b#G%b#I%a#K%_#H%^#D%]#A%[#A|%d*I%c*G%d*D%d*@%e*D%d*I|%d#y%c#x%c#u%d#r%e#s%e#v%e#x%d#y|%e*>%d*=%d*5%c*2%e*.%f*/%f*2%f*7%e*>|%g#o%g#q%d#p%d#l%d#j%e#g%g#i%g#l%g#o%g#o|%f#Z%f#]%f#_%d#^%d#W%c#R%c#O%d#R%d#I%d#G%f#I%g#K%f#Q%e#T%e#X%g#U%h#W%g#Y%f#Z|%Y(A%Z(9%[(5%](7%a(;%b(9%c(>%e(B%g(H%g(O%h(R%h(V%g(X%f(V%e(O%e(I%c(C%a(@%^(=%[(=%Y(A|%h#w%h#y%h#~%g$#%f$$%e$)%e$,%e$/%f$3%e$7%e$9%c$8%c$5%c$3%c$-%c$)%c$$%d#{%f#z%g#x%g#t%h#r%h#w|%i#J%h#I%g#H%g#F%f#B%f#?%f#<%h#@%i#D%i#G%i#J|$z(0$x(1$x(3$w(1$v(1$u(0$r(0$r(2$q(4$p(7$q(:$s(9$u(:$v(8$w(9$y(8$x(:$y(;$z(:${(8$~(7$~(5%#(4%$(3%$(5%&(6%&(8%((8%*(6%*(4%)(2%)(0%((/%&(-%$(+%!(-${(/$z(0|%N!!%N++%M+(%M+%%L+(%K+)%I+*%I+%%H*{%G*y%F*v%E*s%E*p%D*k%C*h%D*e%B*d%@*b%?*d%<*d%<*b%;*a%9*^%6*]%6*Y%4*X%2*V%3*U%6*T%;*S%>*T%?*V%@*Y%C*]%E*b%F*e%I*g%I*e%G*c%E*]%H*[%G*U%D*P%B*R%B*N%B*K%C*H%B*E%C*?%B*8%>*2%9**%9*-%8*.%8*0%9*2%8*4%6*7%2*5%0*5%-*4%**1%)*0%%*.%#*+%!**$~*&%!*$$})~${){$y)z$x)y$w)w$v)v$t)x$r)y$n)z$m)y$m)w$l)v$l)t$n)t$p)s$q)u$r)s$r)r$s)p$t)q$v)r$w)p$v)m$u)k$u)i$v)j$x)k$y)j$x)i$w)f$v)e$u)c$t)b$s)c$s)e$q)f$s)i$r)j$q)l$p)i$o)h$n)f$m)e$l)g$j)h$h)i$f)k$d)j$c)k$a)k$^)j$[)h$X)f$V)d$T)b$S)^$R)[$Q)Y$Q)W$P)U$P)S$N)R$O)P$P)N$N)J$M)I$K)H$I)J$F)L$E)N$D)O$@)P$<)O$;)N$:)K$8)J$6)G$7)G$9)G$:)F$:)D$;)C$=)B$>)@$@)?$>)=$;)<$9);$7)=$6)>$4)>$3)?$1)A$0)C$/)D$,)D$+)D$()E$&)D$))B$+)@$-)>$/)>$0)=$2)=$4)<$5);$6):$9):$<);$=):$?):$@)9$C)9$E)8$G)7$F)6$D)4$E)1$H)2$I)2$L)0$M)/$N).$P)-$S),$S)*$Q)*$Q)($P)$$P)!$M(~$L(z$J(x$H(v$G(t$F(s$E(r$C(p$A(p$=(p$:(p$8(n$7(m$6(l$7(i$:(h$<(g$>(f$A(e$E(c$I(b$K(b$N(b$P(a$O(]$Q(X$S(Y$T(V$U(U$V(T$X(S$W(O$W(L$W(I$X(E$X(C$X(A$[(@$[(=$Z(;$[(9$](7$^(5$a(4$c(2$d(0$c(.$_(/$](0$[(1$Z(2$X(2$W(3$Y(4$W(5$U(5$U(7$U(:$W(;$X(=$Y(>$W(?$U(@$U(A$T(C$S(D$R(F$P(E$O(D$N(C$L(A$K(@$J(?$I(?$H(=$G(<$F(9$F(7$D(6$C(4$B(1$A(/$@(-$@(*$?(($>(%$?(#$A(#$C(#$D(!$G(!$H(!$J&{$L&{$M&y$P&w$R&w$T&v$V&t$W&s$X&s$Z&r$]&p$^&o$a&o$_&n$]&m$_&k$c&j$_&j$]&l$Y&m$X&n$U&p$S&p$Q&r$O&s$M&s$J&t$I&v$G&w$E&x$D&y$B&{$A&}$@(!$>(#$=($$;($$:(&$:()$;(+$;(-$<(/$<(1$<(3$=(4$;(4$:(4$7(3$5(2$3(1$0(/$-(-$+(+$)()$&(%$%(#$!&~#~&}#}&{#{&z#y&y#w&w#t&v#r&x#q&w#n&x#l&y#j&z#h&z#g&z#d&z#a&z#_&y#^&x#]&v#[&t#Y&r#W&o#U&n#S&o#R&p#P&p#N&p#L&m#K&k#J&j#G&j#E&j#C&h#B&g#@&e#>&c#<&a#<&_#;&]#:&[#:&X#:&V#:&T#9&R#9&P#8&O#9&M#:&L#=&K#?&K#A&J#B&I#E&H#F&F#H&E#J&E#K&D#N&D#Q&D#S&C#T&B#W&A#Z&?#^&>#_&?#b&?#e&@#g&B#i&B#k&B#n&A#o&A#q&A#s&?#v&?#x&=#z&;#}&:$!&9$#&9$%&:$&&:$*&:$+&;$,&:$.&8$.&6$-&4$/&2$0&1$2&0$2&,$1&+$1&)$0&%$.&!$/%}$/%z$/%v$.%u$.%s$/%p$0%n$1%l$3%k$4%i$5%h$7%h$8%g$9%e$:%e$<%c$=%a$>%a$?%_$B%_$D%a$F%a$I%b$K%a$M%a$O%_$Q%_$R%a$T%b$V%c$W%d$Z%e$Z%f$]%h$^%i$^%k$a%l$c%o$e%n$g%o$i%q$j%s$k%t$m%v$o%v$n%y$n%{$m%~$n&$$o&&$p&($p&*$q&-$q&1$q&4$q&6$q&8$r&:$p&;$q&=$p&<$n&=$m&=$l&;$k&=$i&>$i&@$h&C$h&E$f&F$e&H$e&K$d&M$e&O$g&O$h&Q$h&U$g&V$g&Y$f&]$f&_$e&b$e&d$f&g$e&i$e&k$e&n$g&o$i&o$k&p$l&q$o&q$p&p$q&n$o&m$o&j$p&h$p&f$o&d$p&b$p&_$r&^$s&]$u&^$v&[$x&_$x&c$y&c$y&g$z&j${&l${&o$z&s$y&v$y&x$y&z$z&}$}&}$~&{%!&y%$&v%$&t%%&r%(&u%)&t%*&w%*&u%)&s%)&q%)&o%&&p%&&r%%&o%$&m%%&l%&&j%(&l%)&h%)&f%(&f%&&d%%&c%!&b%!&a$}&_$z&a$z&c$y&_$w&]$y&[$y&Y$x&V$w&X$w&V$x&U$u&V$s&W$s&U$r&U$p&U$q&R$r&R$u&P$v&O$x&N$z&N$}&M$~&J$~&I%!&G%#&E%%&E%%&C%&&B%&&@%#&@%!&B$~&C${&E$z&G$y&I$y&J$x&L$x&I$w&H$v&I$u&H$s&G$u&G$v&F$w&E$y&C$z&A$z&?$}&=$~&<%#&;%$&9%#&7$~&4%!&0$~&-${&-$y&+$y&)$w&&$v&%$t&&$t&%$r&#$p&!$p%{$p%y$p%x$o%v$q%u$q%s$q%q$r%q$t%o$v%o$w%p$y%p${%p$~%o%!%r%!%t%!%w%!%y%!&!%#&#%(&$%*&!%+%}%,%y%.%{%-&#%0&!%/&$%0&*%2&*%2&,%3&.%6&0%7&3%7&5%7&7%8&9%:&8%;&7%=&7%>&8%>&:%?&<%>&<%=&=%;&:%9&;%9&=%8&?%8&B%8&E%9&H%:&J%9&L%9&N%:&R%<&Q%?&R%@&T%>&V%@&X%A&V%C&X%C&[%C&^%C&a%D&c%E&a%E&]%D&X%D&U%E&T%E&R%G&R%I&Q%J&R%L&T%N&X%O&Z%P&W%O&S%N&Q%K&O%I&K%G&I%E&K%D&M%B&K%A&I%>&H%<&G%<&D%;&C%;&A%=&@%?&?%B&=%C&<%A&8%@&5%A&2%C&2%H&1%I&3%K&8%M&<%P&@%T&E%U&H%X&M%Y&R%X&U%Z&X%Z&]%Z&a%Y&h%X&e%W&g%X&i%W&m%V&r%T&z%S&{%Q&y%P&v%R&m%P&o%M&o%L&q%L&s%N&r%N&s%M&x%N&z%O&y%Q&~%Q(#%P(%%R(&%S($%T(%%U($%T(+%S(,%S()%Q(+%R(.%T(2%V(9%T(;%U(=%U(A%V(D%U(F%V(H%W(F%W(M%V(P%T(W%U(X%V(V%W(T%Y(S%](W%_(X%_(Z%_(a%[(_%Z(a%Y(b%V(a%U(c%S(b%Q(^%P(a%R(d%T(f%U(e%V(f%V(d%Y(e%[(b%](f%_(e%^(g%[(g%Z(i%](h%^(k%^(o%[(s%^(q%a(q%b(u%b(y%b)!%c(}%d)!%d)%%e)*%f)/%f)5%f)6%g);%g)?%i)A%i)F%i)I%h)F%h)K%g)M%g)S%f)X%f)Y%d)W%c)Q%b)P%b)R%b)U%b)W%a)X%b)]%a)e%_)m%a)r%a)u%_)x%^)y%])x%Z)z%Z*!%]*$%[*(%[*+%[*/%[*0%[*4%^*2%_*5%]*G%[*I%Z*N%Z*V%Z*Z%Y*]%W*_%W*c%W*f%W*j%W*n%U*q%V*t%W*r%X*y%X*~%W+(%V!!|%i#x%i#t%j#w%i#x|%i#V%i#R%i#O%j#Q%j#S%j#V%i#V|%j&X%i&T%i&P%j&R%k&Q%k&U%j&X|%k#W%k#T%k#Q%l#S%k#W|%j#t%j#q%j#p%l#o%l#q%k#u%j#t|%k#l%j#i%k#f%k#b%k#d%l#a%l#e%l#j%k#l|%k)G%j)<%l)@%m)A%k)H%k)G|%m&L%l&R%k&M%j&L%i&J%h&I%h&G%i&C%i&D%j&A%l&=%m&<%n&A%m&E%n&I%m&L|%o&Z%n&_%m&[%m&U%m&O%n&L%o&J%o&P%o&S%o&U%o&Z|%o(4%o(2%o(0%n(-%n(+%o((%p(,%p(/%p(2%o(5%o(4|%l)=%l)9%l)3%m)0%n).%o)+%p)1%q)5%o)9%n)=%l)=|%m$+%m$-%l$+%k$&%j$!%k#z%l#x%m#z%m#v%m#t%n#s%o#t%p#u%p#w%q#{%o$!%o$%%o$)%m$+|%t$P%t$U%t$Z%s$^%r$X%q$S%q$R%q$V%p$Q%o$N%n$K%m$G%m$?%l$B%j$@%j$=%h$9%h$=%f$8%g$3%g$-%g$*%g$%%h$)%j$(%i$/%j$,%k$)%l$+%l$.%m$,%o$+%n$1%n$2%o$5%o$1%o$*%p$%%q$$%q#~%r$$%r$&%s$+%s$.%s$0%s$3%t$4%t$7%t$:%t$@%t$G%t$L%t$P|%u%J%s%V%s%S%s%K%r%@%r%H%r%N%r%R%q%T%p%R%q%W%r%b%q%h%q%j%o%a%n%X%n%^%m%Z%l%Y%i%Y%h%[%h%X%g%U%f%X%d%Y%d%W%c%Y%b%U%b%W%a%T%a%Q%^%S%^%O%]%Q%[%T%Y%T%Y%Q%Z%O%[%M%Z%N%X%K%X%Q%X%S%W%N%U%I%T%C%T%@%S%>%Q%<%P%7%O%3%O%0%N%/%K%.%I%*%H%+%F%*%D%)%D%%%F%!%F$z%G$y%I$w%K$t%M$s%N$r%P$p%R$p%R$o%U$q%U$t%X$u%W$s%W$p%W$n%Z$n%Z$p%Y$t%Z$q%[$o%[$m%[$k%^$n%_$l%a$k%c$h%d$f%f$_%f$Z%f$U%f$P%g$N%h$J%i$O%i$S%i$K%j$F%l$N%m$V%n$Q%o$S%p$Z%q$^%r$b%r$i%r$o%r$q%s$v%r${%r%!%q%&%r$~%t%)%t%0%u%3%u%:%u%J";
  const COAST = (() => {
    const idx = {}; for (let i = 0; i < CA.length; i++) idx[CA[i]] = i;
    return CD.split("|").map(s => {
      const n = s.length / 4, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++){
        const la = ((idx[s[i*4]] * 89 + idx[s[i*4+1]]) / 2 - 90) * D2R;
        const lo = ((idx[s[i*4+2]] * 89 + idx[s[i*4+3]]) / 2 - 180) * D2R;
        const c = Math.cos(la);
        a[i*3] = c * Math.cos(lo); a[i*3+1] = Math.sin(la); a[i*3+2] = -c * Math.sin(lo);
      }
      return a;
    });
  })();

  function colors(){
    const dark = document.documentElement.dataset.theme === "dark" ||
      document.documentElement.classList.contains("auto-dark");
    return dark
      ? { dark, sphere0:"#1d1d24", sphere1:"#0e0e13", grid:"#2e2e36", limb:"#44444e",
          coast:"rgba(190,190,200,.8)", coastBack:"rgba(190,190,200,.10)",
          atmo:"rgba(255,110,90,.25)", night:"rgba(0,0,4,.45)",
          orbit:"#ff4f38", rocket:"#ff6e57", star:"rgba(228,228,231,.5)",
          pad:"#f4f4f5", txt:"#a3a3ab", halo:"#0b0b0f" }
      : { dark, sphere0:"#fafafa", sphere1:"#e8e8ec", grid:"#d4d4d8", limb:"#a1a1aa",
          coast:"rgba(82,82,88,.8)", coastBack:"rgba(82,82,88,.10)",
          atmo:"rgba(214,51,22,.13)", night:"rgba(23,23,27,.12)",
          orbit:"#d63316", rocket:"#e03a22", star:"rgba(0,0,0,0)",
          pad:"#17171b", txt:"#58585e", halo:"#ffffff" };
  }
  function ll2xyz(lat, lon){
    const la = lat * D2R, lo = lon * D2R;
    return [Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)];
  }
  const llr = (la, lo, rad) => {
    const c = Math.cos(la);
    return [c * Math.cos(lo) * rad, Math.sin(la) * rad, -c * Math.sin(lo) * rad];
  };
  function rotY(p, a){ const c = Math.cos(a), s = Math.sin(a); return [p[0]*c - p[2]*s, p[1], p[0]*s + p[2]*c]; }
  function rotX(p, a){ const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1]*c - p[2]*s, p[1]*s + p[2]*c]; }
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };

  /* subsolar direction at a given time (good to ~1°) */
  function sunDir(d){
    const D = (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
    const dec = -23.44 * Math.cos(TAU * (D + 10) / 365.24) * D2R;
    const h = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    const lonS = (12 - h) * 15 * D2R;
    const c = Math.cos(dec);
    return [c * Math.cos(lonS), Math.sin(dec), -c * Math.sin(lonS)];
  }

  /* deterministic starfield */
  const STARS = (() => {
    let s = 0x9e3779b9; const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    const a = [];
    for (let i = 0; i < 130; i++) a.push([rnd(), rnd(), .4 + rnd() * 1.1, .25 + rnd() * .75]);
    return a;
  })();

  function makeRenderer(cv){
    const ctx = cv.getContext("2d");
    let W = 0, H = 0, DPR = 1, R = 0, cx = 0, cy = 0, Z = 1;
    let yw = 0, tl = 0, cy_ = 1, cs_ = 0, ty_ = 1, ts_ = 0;
    function resize(){
      DPR = Math.min(devicePixelRatio || 1, 1.5);
      W = cv.clientWidth * DPR; H = cv.clientHeight * DPR;
      if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; }
      R = Math.min(W, H) * 0.36 * Z; cx = W / 2; cy = H / 2;
    }
    function setView(yaw, tilt){
      yw = yaw; tl = tilt;
      cy_ = Math.cos(yaw); cs_ = Math.sin(yaw);
      ty_ = Math.cos(tilt); ts_ = Math.sin(tilt);
    }
    function pj(x, y, z){
      const x1 = x * cy_ - z * cs_, z1 = x * cs_ + z * cy_;
      const y2 = y * ty_ - z1 * ts_, z2 = y * ts_ + z1 * ty_;
      return [cx + x1 * R, cy - y2 * R, z2];
    }
    const unview = v => rotY(rotX(v, -tl), -yw);   // camera space -> world
    function stars(C){
      if (!C.dark) return;
      ctx.fillStyle = C.star;
      for (const s of STARS){
        const x = s[0] * W, y = s[1] * H;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < R * R * 1.12) continue;
        ctx.globalAlpha = s[3];
        ctx.fillRect(x, y, s[2] * DPR, s[2] * DPR);
      }
      ctx.globalAlpha = 1;
    }
    function sphere(C){
      const g = ctx.createRadialGradient(cx - R * .45, cy - R * .5, R * .1, cx, cy, R * 1.02);
      g.addColorStop(0, C.sphere0); g.addColorStop(1, C.sphere1);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      const a = ctx.createRadialGradient(cx, cy, R * .97, cx, cy, R * 1.16);
      a.addColorStop(0, "rgba(0,0,0,0)"); a.addColorStop(.25, C.atmo); a.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = a;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.16, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.limb; ctx.lineWidth = DPR;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    }
    function grid(C){
      ctx.strokeStyle = C.grid; ctx.lineWidth = DPR * 0.7; ctx.globalAlpha = .5;
      for (let lat = -60; lat <= 60; lat += 30) polyline(latCircle(lat), false);
      for (let lon = 0; lon < 180; lon += 30) polyline(meridian(lon), false);
      ctx.globalAlpha = 1;
    }
    function coasts(C){
      ctx.lineWidth = DPR * 0.9; ctx.lineJoin = "round";
      for (const back of [true, false]){
        ctx.strokeStyle = back ? C.coastBack : C.coast;
        ctx.beginPath();
        for (const a of COAST){
          let pen = false;
          for (let i = 0; i < a.length; i += 3){
            const x1 = a[i] * cy_ - a[i+2] * cs_, z1 = a[i] * cs_ + a[i+2] * cy_;
            const y2 = a[i+1] * ty_ - z1 * ts_, z2 = a[i+1] * ts_ + z1 * ty_;
            const front = z2 > -0.02;
            if (back ? !front : front){
              const px = cx + x1 * R, py = cy - y2 * R;
              pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py); pen = true;
            } else pen = false;
          }
        }
        ctx.stroke();
      }
    }
    /* night-side shading for a given sun direction */
    function night(sun, C){
      const v = unview([0, 0, 1]);                     // world vector toward camera
      let k = Math.abs(sun[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
      const e1 = norm(cross(sun, k)), e2 = norm(cross(sun, e1));
      const a = dot(e1, v), b = dot(e2, v), m = Math.hypot(a, b);
      ctx.fillStyle = C.night;
      if (m < .04){                                    // sun along view axis
        if (dot(v, sun) < 0){ ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); }
        return;
      }
      const th0 = Math.atan2(b, a);
      const P = [];                                    // front half of the terminator
      const N = 36;
      for (let j = 0; j <= N; j++){
        const th = th0 - Math.PI / 2 + (j / N) * Math.PI;
        const p = [e1[0]*Math.cos(th)+e2[0]*Math.sin(th),
                   e1[1]*Math.cos(th)+e2[1]*Math.sin(th),
                   e1[2]*Math.cos(th)+e2[2]*Math.sin(th)];
        P.push(pj(p[0], p[1], p[2]));
      }
      const A = P[0], B = P[P.length - 1];
      const angA = Math.atan2(A[1] - cy, A[0] - cx);
      const angB = Math.atan2(B[1] - cy, B[0] - cx);
      // pick the limb arc whose midpoint is on the night side
      const mid = (from, to, ccw) => {
        let d = to - from;
        if (ccw && d > 0) d -= TAU;
        if (!ccw && d < 0) d += TAU;
        return from + d / 2;
      };
      let ccw = false;
      let gm = mid(angB, angA, ccw);
      let w = unview([Math.cos(gm), -Math.sin(gm), 0]);
      if (dot(w, sun) > 0){ ccw = true; }
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R + DPR, 0, TAU); ctx.clip();
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      for (let j = 1; j < P.length; j++) ctx.lineTo(P[j][0], P[j][1]);
      ctx.arc(cx, cy, R, angB, angA, !ccw);
      ctx.closePath();
      ctx.fill();
      // soften the terminator line
      ctx.strokeStyle = C.night; ctx.lineWidth = 5 * DPR; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      for (let j = 1; j < P.length; j++) ctx.lineTo(P[j][0], P[j][1]);
      ctx.stroke();
      ctx.restore();
    }
    const latCircle = lat => { const p = []; for (let l = 0; l <= 360; l += 6) p.push(ll2xyz(lat, l)); return p; };
    const meridian = lon => { const p = []; for (let l = -90; l <= 90; l += 6) p.push(ll2xyz(l, lon)); p.push(...[...Array(31)].map((_, i) => ll2xyz(90 - i * 6, lon + 180))); return p; };
    function polyline(pts, back){
      ctx.beginPath();
      let pen = false;
      for (const p of pts){
        const [x, y, z] = pj(p[0], p[1], p[2]);
        const front = z > -0.02;
        if (back ? !front : front){ pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; }
        else pen = false;
      }
      ctx.stroke();
    }
    function earth(yaw, tilt, C, sun){
      setView(yaw, tilt);
      stars(C); sphere(C); grid(C); coasts(C);
      if (sun) night(sun, C);
    }
    function label(text, C){
      if (!text) return;
      ctx.font = `600 ${10 * DPR}px Inter, sans-serif`;
      const pad = 14 * DPR;
      ctx.fillStyle = C.orbit;
      ctx.fillRect(pad, H - pad - 8 * DPR, 3 * DPR, 8 * DPR);
      ctx.fillStyle = C.txt;
      try{ ctx.letterSpacing = "0.12em"; }catch(e){}
      ctx.fillText(text.toUpperCase(), pad + 7 * DPR, H - pad);
      try{ ctx.letterSpacing = "0em"; }catch(e){}
    }
    function setZoom(z){ Z = Math.max(.55, Math.min(4, z)); R = Math.min(W, H) * 0.36 * Z; }
    return { ctx, resize, earth, polyline, setView, pj, label, setZoom, get Z(){ return Z; },
      get R(){ return R; }, get DPR(){ return DPR; }, get W(){ return W; }, get H(){ return H; } };
  }

  /* ---------- mission profile ---------- */
  function orbitSpec(orbitName, lat){
    const o = (orbitName || "").toLowerCase();
    const incl = Math.max(Math.abs(lat || 28) * D2R, 0.25);
    if (o.includes("sun-sync") || o.includes("sso") || o.includes("polar"))
      return { r: 1.3, incl: 97 * D2R, revs: 1, label: "near-polar orbit" };
    if (o.includes("geo") && !o.includes("transfer"))
      return { r: 1.85, incl: 0.12, revs: .3, label: "geostationary orbit" };
    if (o.includes("gto") || o.includes("transfer"))
      return { rPer: 1.16, rApo: 2.45, incl: incl, ell: true, revs: 1, label: "transfer ellipse" };
    if (o.includes("mars"))
      return { r: 1.35, incl: incl, esc: true, target: "Mars", label: "escape trajectory" };
    if (o.includes("lunar") || o.includes("moon") || o.includes("selen"))
      return { r: 1.35, incl: incl, esc: true, target: "Moon", label: "escape trajectory" };
    if (o.includes("helio") || o.includes("escape") || o.includes("injection"))
      return { r: 1.35, incl: incl, esc: true, target: "deep space", label: "escape trajectory" };
    if (o.includes("medium") || o.includes("meo"))
      return { r: 1.6, incl: Math.max(incl, .9), revs: .55, label: "medium Earth orbit" };
    if (o.includes("suborbital"))
      return { r: 1.16, incl: incl, sub: true, label: "suborbital arc" };
    return { r: 1.28, incl: incl, revs: 1, label: "low Earth orbit" };
  }

  let raf = 0, mode = null;
  function stop(){ mode = null; if (raf) cancelAnimationFrame(raf); raf = 0; }

  /* ---------- per-launch flight animation ---------- */
  function play(cv, launch){
    stop();
    const r = makeRenderer(cv);
    const lat = parseFloat(launch.latitude), lon = parseFloat(launch.longitude);
    const okLL = isFinite(lat) && isFinite(lon);
    const padLL = okLL ? [lat, lon] : [28.5, -80.6];
    const spec = orbitSpec(launch.orbit, padLL[0]);
    const net = launch.net instanceof Date && isFinite(+launch.net) ? launch.net : new Date();
    const sun = sunDir(net);
    const cap = document.getElementById("orbitCap");
    if (cap) cap.textContent = `Illustrative ascent to ${spec.label}` + (launch.pad ? ` from ${launch.pad}` : "") +
      (spec.target ? ` — bound for ${spec.target}` : "");

    /* --- orbital plane through the pad (real azimuth) --- */
    const phi = padLL[0] * D2R, lam = padLL[1] * D2R;
    let inc = spec.incl;
    let dogleg = false;
    if (Math.sin(inc) < Math.abs(Math.sin(phi)) + .01){ dogleg = true; }
    const dlon = u => Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u));
    const u0b = Math.asin(Math.max(-1, Math.min(1, Math.sin(phi) / Math.sin(inc))));
    const u0 = dogleg ? 0 : (inc > Math.PI / 2 ? Math.PI - u0b : u0b);
    const DU = spec.sub ? 13 * D2R : 40 * D2R;
    const uIns = u0 + DU;
    const OM = dogleg ? (lam + 42 * D2R) - dlon(uIns) : lam - dlon(u0);
    const rPer = spec.ell ? spec.rPer : spec.r;
    const aSemi = spec.ell ? (spec.rPer + spec.rApo) / 2 : spec.r;
    const ecc = spec.ell ? (spec.rApo - spec.rPer) / (spec.rApo + spec.rPer) : 0;
    function ringP(u){
      const sla = Math.sin(inc) * Math.sin(u);
      const la = Math.asin(Math.max(-1, Math.min(1, sla)));
      const lo = OM + dlon(u);
      const rad = spec.ell ? aSemi * (1 - ecc * ecc) / (1 + ecc * Math.cos(u - uIns)) : spec.r;
      return llr(la, lo, rad);
    }
    const ease = k => k * k * (3 - 2 * k);
    function ascP(k){                    // ascent point, k 0..1
      const e = ease(k);
      const alt = 1.004 + e * (rPer - 1.004) + Math.sin(e * Math.PI) * .09;
      if (dogleg){
        const la = phi + e * (Math.asin(Math.sin(inc) * Math.sin(uIns)) - phi);
        const lo = lam + e * ((OM + dlon(uIns)) - lam);
        return llr(la, lo, alt);
      }
      const u = u0 + e * DU;
      const sla = Math.sin(inc) * Math.sin(u);
      return llr(Math.asin(Math.max(-1, Math.min(1, sla))), OM + dlon(u), alt);
    }
    /* Kepler: uniform mean anomaly -> eccentric -> true (fast perigee, slow apogee) */
    function keplerU(f){
      if (!spec.ell) return uIns + f * TAU * (spec.revs || 1);
      const M = f * TAU;
      let E = M;
      for (let i = 0; i < 4; i++) E = E - (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E));
      const nu = 2 * Math.atan2(Math.sqrt(1 + ecc) * Math.sin(E / 2), Math.sqrt(1 - ecc) * Math.cos(E / 2));
      return uIns + nu;
    }
    const pp = ll2xyz(padLL[0], padLL[1]);
    const yawBase = lam + Math.PI / 2;
    const tilt = .38 - phi * .35;
    const CYCLE = 12000, ASC = .40;
    mode = "play";
    let t0 = null, tPrev = 1, trail = [], booster = null;

    function phaseText(t){
      if (spec.sub){
        const w = Math.min(1, t / .68);
        if (w < .16) return "liftoff";
        if (w < .42) return "boost";
        if (w < .58) return "apogee";
        if (w < .97) return "descent";
        return "touchdown";
      }
      if (t < ASC){
        const k = t / ASC;
        if (k < .12) return "liftoff";
        if (k < .30) return "max-q";
        if (k < .48) return "stage separation";
        if (k < .62) return "fairing separation";
        return "upper stage burn";
      }
      if (t < ASC + .05) return spec.esc ? "injection burn" : "orbit insertion";
      if (spec.esc) return "→ " + (spec.target || "escape");
      return "coast";
    }

    function frame(now){
      if (mode !== "play") return;
      if (!t0) t0 = now;
      const C = colors();
      r.resize();
      const t = reduced ? .55 : ((now - t0) % CYCLE) / CYCLE;
      if (t < tPrev){ trail.length = 0; booster = null; }
      tPrev = t;
      const yaw = yawBase + (reduced ? 0 : Math.sin((now - t0) / 9000) * .1);
      const { ctx } = r;
      ctx.clearRect(0, 0, r.W, r.H);
      r.earth(yaw, tilt, C, sun);

      // pad marker
      const [px, py, pz] = r.pj(pp[0], pp[1], pp[2]);
      if (pz > 0){
        ctx.fillStyle = C.pad;
        ctx.beginPath(); ctx.arc(px, py, 3 * r.DPR, 0, TAU); ctx.fill();
        if (!reduced){
          ctx.strokeStyle = C.pad; ctx.globalAlpha = Math.max(0, .5 - (t * 4) % .8);
          ctx.beginPath(); ctx.arc(px, py, (4 + (t * 160) % 14) * r.DPR, 0, TAU); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // target orbit ring (dashed) — or the full hop path for suborbital
      ctx.setLineDash([4 * r.DPR, 5 * r.DPR]); ctx.strokeStyle = C.orbit; ctx.lineWidth = r.DPR;
      if (spec.sub){
        const hop = []; for (let k = 0; k <= 1.001; k += .04) hop.push(subP(Math.min(1, k)));
        ctx.globalAlpha = .5; r.polyline(hop, false);
      } else if (!spec.esc){
        const ring = []; for (let u = 0; u <= 360; u += 3) ring.push(ringP(kepAngle(u)));
        ctx.globalAlpha = .16; r.polyline(ring, true);
        ctx.globalAlpha = .5;  r.polyline(ring, false);
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;

      // flight
      if (spec.sub) flySub(t, C);
      else fly(t, C);

      r.label(phaseText(t), C);
      if (!reduced) raf = requestAnimationFrame(frame);
    }
    const kepAngle = deg => uIns + deg * D2R;

    function drawPath(f, C){          // ascent trace up to fraction f of ascent
      ctx_path(r.ctx, C);
      let pen = false;
      for (let k = 0; k <= f + 1e-9; k += .02){
        const q = ascP(Math.min(k, f));
        const [x, y, z] = r.pj(q[0], q[1], q[2]);
        if (z > -0.1){ pen ? r.ctx.lineTo(x, y) : r.ctx.moveTo(x, y); pen = true; } else pen = false;
      }
      r.ctx.stroke(); r.ctx.globalAlpha = 1;
    }
    function ctx_path(ctx, C){
      ctx.strokeStyle = C.rocket; ctx.lineWidth = 1.7 * r.DPR; ctx.lineCap = "round";
      ctx.globalAlpha = .9; ctx.beginPath();
    }
    function head_(p, C, fade){
      const [hx, hy, hz] = r.pj(p[0], p[1], p[2]);
      if (hz > -0.15 && fade > 0){
        const { ctx } = r;
        ctx.fillStyle = C.rocket;
        ctx.shadowColor = C.rocket; ctx.shadowBlur = 9 * r.DPR;
        ctx.globalAlpha = Math.min(1, fade);
        ctx.beginPath(); ctx.arc(hx, hy, 2.8 * r.DPR, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
    }
    function trail_(C){
      const { ctx } = r;
      for (let i = 1; i < trail.length; i++){
        const a = r.pj(trail[i-1][0], trail[i-1][1], trail[i-1][2]);
        const b = r.pj(trail[i][0], trail[i][1], trail[i][2]);
        if (a[2] > -0.15 && b[2] > -0.15){
          ctx.strokeStyle = C.rocket; ctx.globalAlpha = (i / trail.length) * .5;
          ctx.lineWidth = (0.4 + (i / trail.length) * 1.3) * r.DPR;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
    function fly(t, C){
      const { ctx } = r;
      const asc = Math.min(1, t / ASC);
      drawPath(asc, C);
      // booster separation + fall-back
      if (asc >= .40 && asc < 1 && !booster) booster = { k: asc };
      if (booster){
        const age = (t - booster.k * ASC) / .12;                    // 0..1 over ~1.4s
        if (age < 1){
          const back = booster.k - age * .16;
          const q = ascP(Math.max(0, back));
          const fall = q.map(v => v / Math.hypot(q[0], q[1], q[2]) * Math.max(1.002, Math.hypot(q[0], q[1], q[2]) - age * age * .28));
          const [bx, by, bz] = r.pj(fall[0], fall[1], fall[2]);
          if (bz > -0.1){
            ctx.fillStyle = C.txt; ctx.globalAlpha = (1 - age) * .8;
            ctx.beginPath(); ctx.arc(bx, by, 1.8 * r.DPR, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
      let head;
      if (t < ASC) head = ascP(asc);
      else if (spec.esc){
        const w = (t - ASC) / (1 - ASC);
        const u = uIns + ease(Math.min(1, w * 1.4)) * .9;
        const rad = rPer + w * w * 1.9;
        const sla = Math.sin(inc) * Math.sin(u);
        head = llr(Math.asin(Math.max(-1, Math.min(1, sla))), OM + dlon(u), Math.min(rad, 2.7));
        // destination marker
        const dst = llr(Math.asin(Math.max(-1, Math.min(1, Math.sin(inc) * Math.sin(uIns + .9)))), OM + dlon(uIns + .9), 2.55);
        const [dx, dy, dz] = r.pj(dst[0], dst[1], dst[2]);
        if (dz > -0.2 && spec.target){
          ctx.strokeStyle = C.txt; ctx.globalAlpha = .7; ctx.lineWidth = r.DPR;
          ctx.beginPath(); ctx.arc(dx, dy, 3.4 * r.DPR, 0, TAU); ctx.stroke();
          ctx.font = `500 ${10 * r.DPR}px Inter, sans-serif`; ctx.fillStyle = C.txt;
          ctx.fillText(spec.target, dx + 7 * r.DPR, dy + 3 * r.DPR);
          ctx.globalAlpha = 1;
        }
      } else {
        head = ringP(keplerU((t - ASC) / (1 - ASC)));
      }
      if (t >= ASC){
        trail.push(head);
        if (trail.length > 26) trail.shift();
        trail_(C);
      }
      // insertion flash
      if (t >= ASC && t < ASC + .05 && !reduced){
        const q = ascP(1);
        const [fx, fy, fz] = r.pj(q[0], q[1], q[2]);
        if (fz > -0.1){
          const g = (t - ASC) / .05;
          ctx.strokeStyle = C.rocket; ctx.globalAlpha = (1 - g) * .7; ctx.lineWidth = 1.5 * r.DPR;
          ctx.beginPath(); ctx.arc(fx, fy, (3 + g * 15) * r.DPR, 0, TAU); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      head_(head, C, spec.esc && t > .92 ? (1 - t) * 12 : 1);
    }
    function subP(w){                   // suborbital hop point
      const e = ease(w);
      const u = u0 + e * DU;
      const alt = 1.004 + Math.sin(e * Math.PI) * .30;
      const sla = Math.sin(inc) * Math.sin(u);
      return llr(Math.asin(Math.max(-1, Math.min(1, sla))), OM + dlon(u), alt);
    }
    function flySub(t, C){
      const { ctx } = r;
      const w = Math.min(1, t / .68);
      // trace so far
      ctx_path(ctx, C);
      let pen = false;
      for (let k = 0; k <= w + 1e-9; k += .02){
        const q = subP(Math.min(k, w));
        const [x, y, z] = r.pj(q[0], q[1], q[2]);
        if (z > -0.1){ pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true; } else pen = false;
      }
      ctx.stroke(); ctx.globalAlpha = 1;
      head_(subP(w), C, t < .74 ? 1 : Math.max(0, 1 - (t - .74) * 8));
      if (t >= .68 && t < .78 && !reduced){       // touchdown pulse
        const q = subP(1);
        const [fx, fy, fz] = r.pj(q[0], q[1], q[2]);
        if (fz > -0.1){
          const g = (t - .68) / .10;
          ctx.strokeStyle = C.pad; ctx.globalAlpha = (1 - g) * .6; ctx.lineWidth = 1.4 * r.DPR;
          ctx.beginPath(); ctx.arc(fx, fy, (2 + g * 12) * r.DPR, 0, TAU); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    }
    raf = requestAnimationFrame(frame);
    if (reduced) raf = requestAnimationFrame(frame);   // single static render
  }

  /* ---------- map of all launch sites (live terminator) ---------- */
  function map(cv, pads, highlightKey, onPick){
    if (cv.__rltPick) cv.removeEventListener("click", cv.__rltPick);
    if (onPick){
      cv.__rltPick = (ev) => {
        const rc = cv.getBoundingClientRect();
        const sx = (ev.clientX - rc.left) * (cv.width / rc.width);
        const sy = (ev.clientY - rc.top) * (cv.height / rc.height);
        let best = null, bd = 1e9;
        for (const h of (cv.__rltHits || [])){
          const d = Math.hypot(h[0] - sx, h[1] - sy);
          if (d < bd){ bd = d; best = h; }
        }
        if (best && bd < 22 * (cv.__rltDPR || 1)) onPick(best[2]);
      };
      cv.addEventListener("click", cv.__rltPick);
    }
    stop();
    const r = makeRenderer(cv);
    mode = "map";
    let t0 = null;
    const hot = pads.find(p => p.key === highlightKey);
    const yaw0 = hot ? hot.lon * D2R + Math.PI / 2 : .6;
    const tilt = hot ? Math.max(-.5, Math.min(.7, .42 - hot.lat * D2R * .3)) : .42;
    function frame(now){
      if (mode !== "map") return;
      if (!t0) t0 = now;
      const C = colors();
      r.resize();
      const yaw = yaw0 + (reduced ? 0 : (now - t0) / 16000 * TAU * .3);
      const { ctx } = r;
      ctx.clearRect(0, 0, r.W, r.H);
      r.earth(yaw, tilt, C, sunDir(new Date()));
      ctx.font = `${10.5 * r.DPR}px Inter, sans-serif`;
      const taken = [], hits = [];
      for (const p of pads){
        const q = ll2xyz(p.lat, p.lon);
        const [x, y, z] = r.pj(q[0], q[1], q[2]);
        if (z <= 0) continue;
        const hotP = p.key === highlightKey;
        ctx.fillStyle = hotP ? C.pad : C.orbit;
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6 * r.DPR;
        ctx.globalAlpha = .95;
        ctx.beginPath(); ctx.arc(x, y, (2.4 + Math.min(p.n, 8) * .55) * r.DPR, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
        if (hotP && !reduced){
          ctx.strokeStyle = C.pad; ctx.globalAlpha = .5;
          ctx.beginPath(); ctx.arc(x, y, (7 + (now / 60 % 10)) * r.DPR / 1.2, 0, TAU); ctx.stroke();
        }
        hits.push([x, y, p.key]);
        const lbl = p.name + " · " + p.n;
        let ly = y + 3 * r.DPR;
        while (taken.some(q2 => Math.abs(q2[1] - ly) < 12 * r.DPR && Math.abs(q2[0] - x) < 150 * r.DPR)) ly += 13 * r.DPR;
        taken.push([x, ly]);
        ctx.globalAlpha = 1; ctx.lineWidth = 3 * r.DPR; ctx.strokeStyle = C.halo; ctx.lineJoin = "round";
        ctx.strokeText(lbl, x + 8 * r.DPR, ly);
        ctx.fillStyle = C.txt;
        ctx.fillText(lbl, x + 8 * r.DPR, ly);
      }
      cv.__rltHits = hits; cv.__rltDPR = r.DPR;
      if (!reduced) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  window.RLTOrbit = { play, map, stop,
    engine: { makeRenderer, ll2xyz, llr, rotX, rotY, sunDir, colors, CA, CD } };
})();
