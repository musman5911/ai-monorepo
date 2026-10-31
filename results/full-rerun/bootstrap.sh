#!/usr/bin/env bash
set -u
cd /home/user/full-rerun
out=results/full-rerun
printf '%s\n' '2ddf5bccd555b779ee7446c038a30fc5bcd1bcb0' > "$out/install.txt"
node --version >> "$out/install.txt"
npm --version >> "$out/install.txt"
for dir in . dairy_farm/backend agri_farm/backend flock_farm/backend dairy_farm/client agri_farm/frontend flock_farm/client; do
 echo "INSTALL $dir"
 echo "COMMAND: (cd $dir && npm ci --no-audit --no-fund)" >> "$out/install.txt"
 (cd "$dir" && npm ci --no-audit --no-fund) >> "$out/install.txt" 2>&1
 code=$?
 echo "EXIT $code $dir" | tee -a "$out/install.txt"
done
printf 'BOOTSTRAP COMPLETE\n'
